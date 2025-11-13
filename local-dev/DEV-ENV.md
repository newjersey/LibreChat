1. cd `local-dev`
2. rename `.env.example` to `.env`
3. rename `librechat.yaml.example` to `librechat.yaml`
4. run `docker compose up`

the included `.env` sets the config file to `local-dev/librechat.yaml`. Any changes should be made here.

Hot reload is working.

client is reachable at http://localhost:3090 by default