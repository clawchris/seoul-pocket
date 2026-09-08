# Seoul Pocket v2: complete handoff package

This is a self-contained replacement for the original ZIP. The original repository has been merged with every supplied v2 replacement file. No manual merging is needed.

## Start here

Read `CODEX_START_HERE.md`, then the numbered specifications in `docs/`. The current blueprints are `docs/Seoul_Pocket_Product_Blueprint_v2.pdf` and `docs/Seoul_Pocket_Product_Blueprint_v2.docx`. The current screen overview is `qa/Seoul_Pocket_Screen_Overview_v2.png`.

## Private files

`private/OWNER_SETUP.md` contains the setup passphrase. `private/stay-source.json` contains accommodation information. This archive is a private owner/Codex handoff, not a public distribution. Do not publish the ZIP or deploy or commit the private directory. Follow the deployment instructions and use the build output rather than publishing the entire repository.

## Build and evidence

The included `dist/` is rebuilt from the merged v2 source. The packaging-time verification output is `qa/packaging-verify.log`. The v2 screenshots were supplied with the previous update; they are not a new real-iPhone test. Original v1 screenshots and test logs are preserved under `qa/legacy-v1/` for provenance and are not current release evidence.

The earlier limitations remain: deployed Cloudflare behavior, real-iPhone offline restart and persistence, genuine group synchronization, and reviewed offline pronunciation audio are not established by packaging this archive. No new deployment or physical-device testing has been performed. The blueprint content is unchanged; full-document visual review remains outstanding.
