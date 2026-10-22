# Hiisi (working name): design phase. Nothing here is a game yet. The
# mockups are static HTML pages rendered to PNG on an emulated iPhone, and
# GitHub Pages publishes mockups/ on every push to main so they open on a
# phone at https://vesahyp.github.io/hiisi/.
#
#   make mockups-setup  # once: install Playwright and Chromium
#   make mockups        # render every mockup, portrait and landscape, into mockups/shots/
#   make serve          # serve mockups/ on http://localhost:5190 for a phone on the LAN
#   make check          # the mockups render without page errors

.PHONY: mockups-setup mockups serve check

mockups-setup:
	npm install && npx playwright install chromium

mockups:
	node mockups/shoot.mjs

serve:
	npx --yes serve -l 5190 mockups

check: mockups
