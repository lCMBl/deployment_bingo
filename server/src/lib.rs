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