use spacetimedb::{reducer, table, Identity, ReducerContext, Table, Timestamp};

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

#[table(name = bingo_board, public)]
pub struct BingoBoard {
    #[primary_key]
    #[auto_inc]
    id: u32,
    #[index(btree)]
    player_id: Identity,
    #[index(btree)]
    game_session_id: u32,
    #[index(btree)]
    bingo_item_ids: Vec<u32>,
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