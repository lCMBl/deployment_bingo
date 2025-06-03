use std::collections::HashSet;

use spacetimedb::{rand::seq::SliceRandom, reducer, table, Identity, ReducerContext, SpacetimeType, Table, Timestamp};

#[table(name = player, public)]
pub struct Player {
    #[primary_key]
    identity: Identity,
    name: Option<String>,
    online: bool,
}

#[table(name = game_session, public)]
pub struct GameSession {
    #[primary_key]
    #[auto_inc]
    id: u32,
    name: String,
    password: Option<String>, // need to hex encode / hash?
    active: bool,
    winner: Option<Identity>, // the player that won this game
}

#[table(name = player_session, public)]
pub struct PlayerSession {
    #[index(btree)]
    player_id: Identity,
    #[index(btree)]
    game_session_id: u32,
}

#[table(name = bingo_item, public)]
pub struct BingoItem {
    #[primary_key]
    #[auto_inc]
    id: u32,
    body: String,
}

#[table(name = player_item_subject, public)]
/// used to link players to items that they are the subject of,
/// e.g. Scott says "Essentially..."
pub struct PlayerItemSubject {
    #[index(btree)]
    player_id: Identity,
    #[index(btree)]
    bingo_item_id: u32,
}

#[derive(SpacetimeType)]
pub struct BoardItem {
    id: u32,
    /// included so that deleted bingo items don't mess up existing boards.
    body: String,
    checked: bool,
}

#[table(name = bingo_board, public)]
pub struct BingoBoard {
    #[primary_key]
    #[auto_inc]
    id: u32,
    #[index(btree)]
    player_id: Identity,
    #[index(btree)]
    game_session_id: u32,
    bingo_items: Vec<Vec<BoardItem>>,
}

#[table(name = item_check_vote, public)]
pub struct ItemCheckVote {
    #[primary_key]
    #[auto_inc]
    id: u32,
    #[index(btree)]
    game_session_id: u32,
    #[index(btree)]
    bingo_item_id: u32,
    #[index(btree)]
    player_id: Identity,
    created_at: Timestamp,
}

// ==========================================================
#[reducer]
/// Clients invoke this reducer to set their player names.
pub fn set_name(ctx: &ReducerContext, name: String) -> Result<(), String> {
    let name = validate_name(name)?;
    if let Some(player) = ctx.db.player().identity().find(ctx.sender) {
        ctx.db.player().identity().update(Player { name: Some(name), ..player });
        Ok(())
    } else {
        Err("Cannot set name for unknown player".to_string())
    }
}

/// Takes a name and checks if it's acceptable as a user's name.
fn validate_name(name: String) -> Result<String, String> {
    if name.is_empty() {
        Err("Names must not be empty".to_string())
    } else {
        Ok(name)
    }
}

// ----------

#[reducer]
pub fn start_new_game(ctx: &ReducerContext, name: String, password: Option<String>) -> Result<(), String> {
    let name = validate_name(name)?;
    let new_game = ctx.db.game_session().insert(GameSession {
        id: 0, name, password: password.clone(), active: true, winner: None 
    });
    // add the current player to the game automatically
    join_game(ctx, new_game.id, password)?;
    Ok(())
}

#[reducer]
pub fn join_game(ctx: &ReducerContext, game_session_id: u32, password: Option<String>) -> Result<(), String> {
    if let Some(game_session) = ctx.db.game_session().id().find(game_session_id) {
        // check password
        if is_correct_password(game_session.password, password) {
            // make the player's board
            create_bingo_board(ctx, ctx.sender, game_session_id)?;

            // join the session
            ctx.db.player_session().insert(PlayerSession { player_id: ctx.sender, game_session_id });
        }
    }

    Ok(())
}

fn is_correct_password(target_pwd: Option<String>, submitted_pwd: Option<String>) -> bool {
    if let Some(trgt_pwd) = target_pwd {
        if let Some(sub_pwd) = submitted_pwd {
            trgt_pwd == sub_pwd
        } else {
            false
        }
    } else {
        true
    }
}

// ----------

#[reducer]
/// creates a new bingo item, possibly with tagged players that are the subject of the item. 
/// (subject players cannot have the item appear in their game board)
pub fn submit_new_bingo_item(ctx: &ReducerContext, body: String, subject_players: Option<Vec<Identity>>) -> Result<(), String> {
    let new_item = ctx.db.bingo_item().insert(BingoItem { id: 0, body });
    if let Some(sub_players) = subject_players {
        for player_id in sub_players {
            ctx.db.player_item_subject().insert(PlayerItemSubject { player_id, bingo_item_id: new_item.id });
        }
    }

    Ok(())
}

#[reducer]
pub fn delete_bingo_item(ctx: &ReducerContext, bingo_item_id: u32) -> Result<(), String> {
    // first, delete any player item subjects
    ctx.db.player_item_subject().bingo_item_id().delete(bingo_item_id);
    // then, delete the item itself
    ctx.db.bingo_item().id().delete(bingo_item_id);
    Ok(())
}

// ----------

#[reducer]
pub fn create_bingo_board(ctx: &ReducerContext, player_id: Identity, game_session_id: u32) -> Result<(), String> {
    // get all of the forbidden items for this player
    let forbidden_items: HashSet<u32> = ctx.db.player_item_subject().player_id().filter(&player_id).map(|p| {
        p.bingo_item_id
    }).collect();
    
    // get 25 items to fill the board, excluding items with this player as a subject.
    let mut potential_board_items: Vec<BingoItem> = vec![];
    for bingo_item in ctx.db.bingo_item().iter() {
        // add the item to potential board items, as long as it's not in forbidden items
        if !forbidden_items.contains(&bingo_item.id) {
            potential_board_items.push(bingo_item);
        }
    }

    // now that we have our potential bingo items, we need to pick 25 of them at random.
    potential_board_items.shuffle(&mut ctx.rng());
    // pick the first 25 using a map
    let mut bingo_items: Vec<Vec<BoardItem>> = vec![];

    for _x in 0..5 {
        let mut board_column: Vec<BoardItem> = vec![];
        for _y in 0..5 {
            if let Some(bingo_item) = potential_board_items.pop() {
                board_column.push(BoardItem { id: bingo_item.id, body: bingo_item.body.clone(), checked: false });
            } else {
                return Err("Not enough valid bingo items to make a board".to_string());
            }
        }
        bingo_items.push(board_column);
    }
    
    ctx.db.bingo_board().insert(BingoBoard {
        id: 0, player_id, game_session_id, bingo_items
    });
    Ok(())
}

// ----------

// TODO
// casting vote for item check-off
// determining when an item should be checked-off
// determining winner
// game wind down