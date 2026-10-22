# Hiisi: dev, checks, screenshots. The game deploys from GitHub Actions on
# every push to main (.github/workflows/deploy.yml); nothing here deploys.
#
#   make dev           # vite dev server, also on the LAN for a phone
#   make build         # production build -> dist/
#   make preview       # build, then serve it locally
#   make check         # typecheck + build + sim-check + gauntlet + loot-check + screen-check + charge-check + sheets-check + phone-run: what a commit needs green
#   make sim-check     # the floors, the hands, levelling, the save, a replay, the bot, headless
#   make balance       # the bot plays whole runs, one line each (RUNS ?= 6 STYLE ?= best WHO ?= bot)
#   make gauntlet      # the human-limited bot must reach floor TO (3) in most of RUNS (8) runs, with either hand
#   make shots-setup   # once: install Chromium for Playwright
#   make shots         # phone screenshots into shots/ (make shots-en for English)
#   make phone-run     # the human-limited bot plays on an emulated iPhone by real frames, on video (shots/phone/)
#   make loot-check    # loot never covers the play area: the chip, the walk, the card, in portrait and a short landscape (shots/loot/)
#   make icons         # the home-screen PNG icons from public/icon.svg
#   make sheets-check  # every sheet survives a rotation: no sideways scroll, nothing outside, nothing overlapping, portrait to landscape and back
#   make charge-check  # a charge survives walking, a drift and a second touch on an emulated iPhone; a part charge fires with that much
#   make screen-check  # the play screen fills an iPhone in landscape, inside its safe area, from the home screen and in Safari (shots/screen/)
#   make arsenal-shots # each melee family charged with its hit shape showing, landscape (shots/arsenal/)
#   make floor-shots   # three floors of three seeds, the whole floor revealed on the map sheet, into shots/floors/
#   make mockups       # re-render the design mockups into public/mockups/shots/

.PHONY: dev build preview check sim-check balance gauntlet shots-setup shots shots-en phone-run loot-check screen-check charge-check sheets-check icons floor-shots arsenal-shots mockups

dev:
	npm run dev

build:
	npm run build

preview: build
	npm run preview

check:
	npm run typecheck
	npm run build
	npm run sim-check
	npm run gauntlet
	$(MAKE) loot-check
	$(MAKE) screen-check
	$(MAKE) charge-check
	$(MAKE) sheets-check
	$(MAKE) phone-run

sim-check:
	npm run sim-check

RUNS ?= 6
STYLE ?= best
WHO ?= bot
balance:
	npm run balance -- $(RUNS) $(STYLE) $(WHO)

TO ?= 3
gauntlet:
	npm run gauntlet -- $(RUNS) $(TO)

shots-setup:
	npm install && npx playwright install chromium

shots:
	node scripts/shots.mjs

shots-en:
	node scripts/shots.mjs en

loot-check:
	node scripts/loot-check.mjs

SEED ?= 2026
phone-run:
	node scripts/phone-run.mjs $(SEED)

icons:
	node scripts/icons.mjs

screen-check:
	node scripts/screen-check.mjs

charge-check:
	node scripts/charge-check.mjs

sheets-check:
	node scripts/sheets-check.mjs

floor-shots:
	node scripts/floor-shots.mjs

arsenal-shots:
	node scripts/arsenal-shots.mjs

mockups:
	node public/mockups/shoot.mjs
