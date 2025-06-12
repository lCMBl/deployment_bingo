# Deployment Bingo
This is a project to learn more about [SpacetimeDB](https://spacetimedb.com/home), and try my hand at implementing stuff. As such, the client is basically all AI slop, and the whole thing is janky as hell. But, I learned a ton about spacetimeDB, so that's a win!

## Startup Procedure
1. `docker compose up --build -d`
2. `spacetime publish [--server http://localhost:3030] --project-path server  deployment-bingo`
3. `spacetime call [--server http://localhost:3030] deployment-bingo create_player "name" "pass"`

You should now be able to visit the server frontend at [http://localhost:5173/](http://localhost:5173/) and log in with name and pass to start inviting people.

## Known Issues
- Something about docker doesn't like how the spacetime db credentials are being stored. I haven't been able to figure it out yet, but basically every time you reload the page you have to log in again.
- No way to change password. Really the entire auth system is very janky.

