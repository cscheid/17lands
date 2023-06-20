# 17lands analysis

## Setup

You'll need:

- [deno](https://deno.land)
- the MOM game draft data, downloaded into `data/`
- some version of Unix (I'm on macOS, which needs `gzcat`)

## Running

```sh
# This generates a 190MB file on processed-data
gzcat data/game_data_public.MOM.PremierDraft.csv.gz | deno run --unstable --allow-all read-game-data.ts
deno run --unstable --allow-all analyze-game-data.ts MOM
```
