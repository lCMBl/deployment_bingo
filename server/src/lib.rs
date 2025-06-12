use std::{collections::{HashMap, HashSet}, time::Duration};

use argon2::Error;
use spacetimedb::{rand::seq::SliceRandom, reducer, table, Identity, ReducerContext, ScheduleAt, SpacetimeType, Table, TimeDuration, Timestamp};

mod password;
use password::{hash_password, verify_password};

#[table(name = player, public)]
pub struct Player {
    #[primary_key]
    #[auto_inc]
    id: u32,
    #[unique]
    identity: Identity,
    #[index(btree)]
    name: String,
    password: String,
    online: bool,
}

#[table(name = player_invite, public)]
pub struct PlayerInvite {
    #[primary_key]
    #[auto_inc]
    id: u32,
    #[unique]
    token: String,
    used: bool,
}

#[table(
    name = remove_expired_invites_timer,
    scheduled(remove_expired_player_invites)
)]
pub struct RemoveExpiredInvitesTimer {
    #[primary_key]
    #[auto_inc]
    scheduled_id: u64,
    invite_id: u32,
    scheduled_at: ScheduleAt,
}

#[derive(SpacetimeType)]
pub struct BoardItem {
    id: u32,
    /// included so that deleted bingo items don't mess up existing boards.
    body: String,
    checked: bool,
}
#[table(name = game_session, public)]
pub struct GameSession {
    #[primary_key]
    #[auto_inc]
    id: u32,
    name: String,
    #[index(btree)]
    active: bool,
    winner: Option<Identity>, // the player that won this game
    board_items: Vec<BoardItem>,
    started: Timestamp,
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
/// the representation of a bingo board item in an actual board
pub struct BoardItemTile {
    id: u32,
    x: u8,
    y: u8,
}

#[table(
    name = bingo_board,
    public,
    index(name = idx_session_player, btree(columns = [game_session_id, player_id]))
)]
pub struct BingoBoard {
    #[primary_key]
    #[auto_inc]
    id: u32,
    #[index(btree)]
    player_id: Identity,
    #[index(btree)]
    game_session_id: u32,
    bingo_item_tiles: Vec<BoardItemTile>,
}

#[table(
    name = item_check_vote,
    public,
    index(name = idx_session_item, btree(columns = [game_session_id, bingo_item_id]))
)]
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

#[table(
    name = remove_expired_votes_timer,
    scheduled(remove_expired_votes),
    index(name = idx_session_item, btree(columns = [game_session_id, bingo_item_id]))
)]
pub struct RemoveExpiredVotesTimer {
    #[primary_key]
    #[auto_inc]
    scheduled_id: u64,
    bingo_item_id: u32,
    game_session_id: u32,
    scheduled_at: ScheduleAt,
}

// ==========================================================
#[reducer]
/// Clients invoke this reducer to set their player names.
pub fn set_name(ctx: &ReducerContext, name: String) -> Result<(), String> {
    let name = validate_name(name)?;
    if let Some(player) = ctx.db.player().identity().find(ctx.sender) {
        ctx.db.player().id().update(Player { name, ..player });
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
pub fn start_new_game(ctx: &ReducerContext, name: String) -> Result<(), String> {
    let name = validate_name(name)?;
    let new_game = ctx.db.game_session().insert(GameSession {
        id: 0, name, active: true, winner: None, board_items: vec![] , started: ctx.timestamp
    });
    // add the current player to the game automatically
    join_game(ctx, new_game.id)?;
    Ok(())
}

#[reducer]
pub fn join_game(ctx: &ReducerContext, game_session_id: u32) -> Result<(), String> {
    // if let Some(game_session) = ctx.db.game_session().id().find(game_session_id) {
        // check password
        // if is_correct_password(game_session.password, password) {
    // make the player's board
    create_bingo_board(ctx, ctx.sender, game_session_id)?;

    // join the session
    ctx.db.player_session().insert(PlayerSession { player_id: ctx.sender, game_session_id });
        // }
    // }

    Ok(())
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
    // get the set of current board items in the game session
    if let Some(mut game_session) = ctx.db.game_session().id().find(game_session_id) {
        let mut board_items: HashSet<u32> = game_session.board_items.iter().map(|bi| {
            return bi.id;
        }).collect();
        
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
        let mut bingo_item_tiles: Vec<BoardItemTile> = vec![];
        for x in 0..5 {
            for y in 0..5 {
                if let Some(bingo_item) = potential_board_items.pop() {
                    // make a new item tile, and add the board item to the set.
                    bingo_item_tiles.push(BoardItemTile { id: bingo_item.id, x, y });
                    if board_items.insert(bingo_item.id) {
                        game_session.board_items.push(BoardItem { id: bingo_item.id, body: bingo_item.body.clone(), checked: false });
                    }
                } else {
                    return Err("Not enough valid bingo items to make a board".to_string());
                }
            }
        }
        ctx.db.bingo_board().insert(BingoBoard {
            id: 0, player_id, game_session_id, bingo_item_tiles
        });
        // update the game session
        ctx.db.game_session().id().update(game_session);
    }
    
    Ok(())
}

// ----------

#[reducer]
pub fn cast_check_off_vote(ctx: &ReducerContext, game_session_id: u32, bingo_item_id: u32) -> Result<(), String> {
    // insert the vote
    ctx.db.item_check_vote().insert(ItemCheckVote { id: 0, game_session_id, bingo_item_id, player_id: ctx.sender, created_at: ctx.timestamp });
    
    // get the vote threshold we need for this item.
    // this is the count of players in this session, minus the count of players who are the subject of this item, and multiplied by the threshold percentage
    let session_players: HashSet<Identity> = ctx.db.player_session().game_session_id().filter(game_session_id).map(|ps| {
        return ps.player_id;
    }).collect();
    
    let non_voting_players: HashSet<Identity> = ctx.db.player_item_subject().bingo_item_id().filter(bingo_item_id).map(|p| {
        return p.player_id;
    }).collect();
    
    
    // check if we have enough of the vote to check the box off (settings? >50% for now)
    let vote_threshold = get_required_vote_threshold(session_players, non_voting_players, 0.5);
    let vote_count = ctx.db.item_check_vote().idx_session_item().filter((game_session_id, bingo_item_id)).count();
    if vote_count >= vote_threshold {
        // if we have enough, check off the value on the board for everyone that has it.
        // TODO: make board items their own table instead of just a data type?
        if let Some(mut game_session) = ctx.db.game_session().id().find(game_session_id) {
            if let Some(item) = game_session.board_items.iter_mut().find(|bi| bi.id == bingo_item_id) {
                item.checked = true;
            }
            ctx.db.game_session().id().update(game_session);
            // check for game winner
            let boards: Vec<BingoBoard> = ctx.db.bingo_board().game_session_id().filter(game_session_id).collect();
            for board in boards {
                check_for_winner(ctx, board.id)?;
            }
        }
    } else {
        // if we don't have enough and the timer for this vote hasn't already started, start the vote.
        if ctx.db.remove_expired_votes_timer().idx_session_item().filter((game_session_id, bingo_item_id)).count() == 0 {
            let expire_time = ctx.timestamp + TimeDuration::from_micros(10_000_000);
            ctx.db.remove_expired_votes_timer().try_insert(RemoveExpiredVotesTimer {
                scheduled_id: 0,
                game_session_id,
                bingo_item_id,
                scheduled_at: expire_time.into(), // Schedule for a specific time, not interval
            })?;
        }
    }

    Ok(())
}


fn get_required_vote_threshold(session_players: HashSet<Identity>, non_voting_players: HashSet<Identity>, required_percent: f32) -> usize {
    // get the intersection of players in the session and non_voting_players. This is the non-voting count
    let non_voting_session_player_count = session_players.intersection(&non_voting_players).count();

    // get vote threshold
    ((session_players.len() - non_voting_session_player_count) as f32 * required_percent).floor() as usize
}

#[reducer]
pub fn remove_expired_votes(ctx: &ReducerContext, timer: RemoveExpiredVotesTimer) -> Result<(), String> {
    // get all votes for the expired timer, and delete them.
    for vote in ctx.db.item_check_vote().idx_session_item().filter((timer.game_session_id, timer.bingo_item_id)) {
        ctx.db.item_check_vote().id().delete(vote.id);
    }
    // then, delete the timer itself.
    ctx.db.remove_expired_votes_timer().delete(timer);
    Ok(())
}

// ---------
#[reducer]
pub fn check_for_winner(ctx: &ReducerContext, board_id: u32) -> Result<(), String> {
    // check to see if a particular bingo board is a winner
    if let Some(board) = ctx.db.bingo_board().id().find(board_id) {
        // get the session, which has the checked bingo items
        if let Some(mut game_session) = ctx.db.game_session().id().find(board.game_session_id) {
            let mut count_map = HashMap::from([
                ("x0", 0), ("x1", 0), ("x2", 0), ("x3", 0), ("x4", 0),
                ("y0", 0), ("y1", 0), ("y2", 0), ("y3", 0), ("y4", 0),
                ("d1", 0), ("d2", 0), // diagonals 1 and 2
            ]);
            // loop through each board item tile, and add to our count map if the tile it checked
            for bit in board.bingo_item_tiles {
                // TODO this is going to be real slow. Probably best practice to have board items as their own table.
                if let Some(bi) = game_session.board_items.iter().find(|bi| bi.id == bit.id) {
                    if bi.checked {
                        // add to the count dict.
                        if let Some(x_count) = count_map.get_mut(format!("x{}", bit.x).as_str()) {
                           *x_count += 1;
                        }
                        if let Some(y_count) = count_map.get_mut(format!("y{}", bit.y).as_str()) {
                           *y_count += 1;
                        }
                        // add to d1/d2
                        if bit.x == bit.y {
                            if let Some(d_count_1) = count_map.get_mut("d1") {
                                *d_count_1 += 1;
                            }
                        }
                        if bit.x + bit.y == 4 {
                            if let Some(d_count_2) = count_map.get_mut("d2") {
                                *d_count_2 += 1;
                            }
                        }
                    }
                } else {
                    return Err("No board item found in session".to_string());
                }
            }
            // once we have our counts, check to see if any of the counts >= 5. If so, we have a winner!
            let winner = count_map.iter().any(|(_k,v)| v >= &5);
            if winner {
                // then update the session accordingly
                game_session.winner = Some(board.player_id);
                game_session.active = false;
                ctx.db.game_session().id().update(game_session);
            }
        }
    }
    // 1. get the checked status of all board item tiles
    // 2. iterate through all items, and count the checked tiles per x and y. so, if a tile at position 3, 2 is checked, 
    // then the count for x-3 goes up by one, and the count for y-2 goes up by one.
    // if any individual count is at 5, then we have a winner! need to also do special checking for the diagonals, so those are stored separately.
    Ok(())
}

// ------------

#[reducer]
pub fn sign_in(ctx: &ReducerContext, name: String, password: String) {
    
    // find the player by name.
    for player in ctx.db.player().name().filter(&name) {
        // check if the player has the right password
        if let Ok(password_match) = verify_password(&player.password, &password) {
            if password_match {
                // then this is our player, log them in.
                ctx.db.player().id().update(Player { online: true, identity: ctx.sender, ..player });
                break;
            }
        }
    }
}

#[reducer]
pub fn create_player(ctx: &ReducerContext, name: String, password: String) -> Result<(), Error> {
    // hash the player's password
    let password_hash = hash_password(&password)?;
    // insert the new player
    ctx.db.player().insert(Player { id: 0, identity: ctx.sender, name, password: password_hash, online: true });
    Ok(())
}


#[reducer]
pub fn create_player_invite(ctx: &ReducerContext, token: String) {
    // create the player invite record
    let invite = ctx.db.player_invite().insert(PlayerInvite { id: 0, token, used: false });
    // create the expiration timer
    let expire_time = ctx.timestamp + TimeDuration::from_duration(Duration::from_secs(3600));
    ctx.db.remove_expired_invites_timer().insert(RemoveExpiredInvitesTimer {
        scheduled_id: 0,
        invite_id: invite.id,
        scheduled_at: expire_time.into()
    });
}

#[reducer]
pub fn use_player_invite(ctx: &ReducerContext, token: String) -> Result<(), String> {
    if let Some(invite) = ctx.db.player_invite().token().find(&token) {
        if !invite.used {
            // set the invite to used.
            ctx.db.player_invite().id().update(PlayerInvite { used: true, ..invite});
            Ok(())
        } else {
            Err(format!("Invite for token {} has already been used.", &token))
        }
    } else {
        Err(format!("No invite found for token: {}", &token))
    }
}

#[reducer]
pub fn remove_expired_player_invites(ctx: &ReducerContext, timer: RemoveExpiredInvitesTimer) {
    // get the invite for the expired timer, and delete it.
    if let Some(invite) = ctx.db.player_invite().id().find(timer.invite_id) {
        ctx.db.player_invite().id().delete(invite.id);
    }
    // then, delete the timer itself.
    ctx.db.remove_expired_invites_timer().delete(timer);
}
// -------------

#[reducer(client_connected)]
// Called when a client connects to a SpacetimeDB database server
pub fn client_connected(ctx: &ReducerContext) {
    if let Some(player) = ctx.db.player().identity().find(ctx.sender) {
        // If this is a returning player, i.e. we already have a `Player` with this `Identity`,
        // set `online: true`, but leave `name` and `identity` unchanged.
        ctx.db.player().identity().update(Player { online: true, ..player });
    }
}

#[reducer(client_disconnected)]
// Called when a client disconnects from SpacetimeDB database server
pub fn identity_disconnected(ctx: &ReducerContext) {
    if let Some(player) = ctx.db.player().identity().find(ctx.sender) {
        ctx.db.player().identity().update(Player { online: false, ..player });
    } else {
        // This branch should be unreachable,
        // as it doesn't make sense for a client to disconnect without connecting first.
        log::warn!("Disconnect event for unknown player with identity {:?}", ctx.sender);
    }
}


// TODO
// 0. automatic running of the spacetime publish command on startup (copy spacetime module to container, and run spacetime publish from inside container? just do manually through ssh or even remotely?)
// 1. credentials not saved/different id created on joining? (like incognito mode)

// 3. window title name
// 4. need to have proper auth, or at least a way to associate players
// with a different connection. Identity is not reliable. 

// pagination of bingo items
// center login prompt
// pull login details from .env file
// app coloring

// --server http://localhost:6666
// spacetime publish --project-path server  deployment-bingo
// spacetime call --server http://localhost:6666 deployment-bingo submit_new_bingo_item "Someone curses PNNL"
// spacetime logs --server http://localhost:6666 deployment-bingo
// spacetime sql --server http://localhost:6666 deployment-bingo "SELECT * FROM bingo_item"

// spacetime generate --lang typescript --out-dir client/src/module_bindings --project-path server

// spacetime sql --server http://localhost:3030 deployment-bingo "SELECT * FROM player"
// spacetime call --server http://localhost:3030 deployment-bingo create_player "Christian" "barencms"
