### Docker Compose Local Development Steps

This docker-compose assume the use of colima rather than the docker engine. 

#### Colima Setup
Mac:
1. `brew install colima`
2. `colima start --cpu 4 --memory 4` # Alternatively, use `colima template` to set defaults. Then you can use `colima start` without arguments.

#### Running the docker compose
1. `cd local-dev`
2. `cp .env.example .env`
3. `cp librechat.yaml.example librechat.yaml`
4. `docker compose up`

The included `.env` sets the config file to `local-dev/librechat.yaml`. Any changes should be made here.

Client is reachable at http://localhost:3090 and the backend is reachable at http://localhost:3080.
