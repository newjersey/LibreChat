1. cd `local-dev`
2. rename `.env.example` to `.env`
3. rename `librechat.yaml.example` to `librechat.yaml`
4. run `docker compose up`

The included `.env` sets the config file to `local-dev/librechat.yaml`. Any changes should be made here.

Hot reload is working.

Client is reachable at http://localhost:3090 by default. The backend is reachable at http://localhost:3080 and has a copy of the frontend, though this does not perform hot reloads.

Ensure you're running colima with `colima start --cpu 4 --memory 4`, otherwise you'll run out of memory.