# boring-admin-bot

Simple admin bot that copies messages from a source channel to a target channel on a schedule.

Setup

- Copy `.env.example` to `.env` and fill in values.
- Install deps: `npm install`
- Run locally: `npm start`

Env variables (see `.env.example`):

- `ADMIN_BOT_TOKEN`
- `SOURCE_CHANNEL_ID`
- `TARGET_CHANNEL_ID`

Deploy

1. Push repo to GitHub.
2. On Render create a new **Web Service**, link repo, build `npm install`, start `npm start`.
3. Add env vars in Render dashboard.
