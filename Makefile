## This Makefile is temporary, and it will self-destruct after it runs!
## Afterward, the Makefile.dist will be moved to become the new Makefile

.PHONY: template # Runs the config script to instantiate this template
template:
# Copy the setup_template.sh script to a temporary directory:
# This is so we can safely delete the original while the copy is running:
	@export SCRIPT_IS_RUN_FROM_MAKEFILE=true && TMPDIR="$$(mktemp -d)" && cp setup_template.sh $${TMPDIR} && echo "# Copied setup_template.sh to temporary file $${TMPDIR}/setup_template.sh" && echo "# Running $${TMPDIR}/setup_template.sh ..." && echo && $${TMPDIR}/setup_template.sh . "${APP_NAME}"
