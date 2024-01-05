#!/bin/bash

set -e

ask() {
    ## Ask the user a question and set the given variable name with their answer
    ## If the answer is blank, repeat the question.
    local __prompt="${1}"; local __var="${2}"; local __default="${3}"
    while true; do
        read -e -p "${__prompt}"$'\x0a: ' -i "${__default}" ${__var}
        export ${__var}
        [[ -z "${!__var}" ]] || break
    done
}
stderr(){ echo "$@" >/dev/stderr; }
error(){ stderr "Error: $@"; }
fault(){ test -n "$1" && error $1; stderr "Exiting."; exit 1; }
debug_var() {
    local var=$1
    check_var var
    echo "## DEBUG: ${var}=${!var}" > /dev/stderr
}
check_var(){
    local __missing=false
    local __vars="$@"
    for __var in ${__vars}; do
        if [[ -z "${!__var}" ]]; then
            error "${__var} variable is missing."
            __missing=true
        fi
    done
    if [[ ${__missing} == true ]]; then
        fault
    fi
}
make_var_name() {
    # Make an environment variable out of any string
    # Replaces all invalid characters with a single _
    echo "$@" | sed -e 's/  */_/g' -e 's/--*/_/g' -e 's/[^a-zA-Z0-9_]/_/g' -e 's/__*/_/g' -e 's/.*/\U&/' -e 's/__*$//' -e 's/^__*//'
}
confirm() {
    ## Confirm with the user
    local default=$1; local prompt=$2; local question=${3:-". Proceed?"}
    check_var default prompt question
    if [[ $default == "y" || $default == "yes" || $default == "ok" ]]; then
        dflt="Y/n"
    else
        dflt="y/N"
    fi
    read -e -p "${prompt}${question} (${dflt}): " answer
    answer=${answer:-${default}}

    if [[ ${answer,,} == "y" || ${answer,,} == "yes" || ${answer,,} == "ok" ]]; then
        return 0
    else
        return 1
    fi
}

if [[ "${SCRIPT_IS_RUN_FROM_MAKEFILE}" != "true" ]]; then
    fault "Do not run this script directly. It should only be run via 'make'"
fi

if [[ -z "$@" ]]; then
    fault "Missing directory argument"
fi

DIRECTORY="$1"; shift
cd "${DIRECTORY}"
APP_NAME="$1"; shift

if test -d .git; then
    if [[ -n $(git status -s) ]]; then
       echo
       stderr "There are uncommited changes in this repository."
       fault "Please \"git commit\" or remove these changes first, before running this script."
    fi
fi

test -z "${APP_NAME}" && ask "Enter the name for your new application:" APP_NAME "$(basename $(pwd))"

echo
echo "This script will now rename the example environment variables:"
echo

APP_NAME_VAR=$(make_var_name ${APP_NAME})
APP_NAME_PREFIX=$(echo -n ${APP_NAME_VAR} && echo "_")
APP_DOMAIN=$(echo -n ${APP_NAME_VAR} | sed -e 's/.*/\L&/' -e 's/__*/-/g')

if ! confirm yes "Use the new variable name prefix ${APP_NAME_PREFIX}" " ?"; then
    while true; do
        ask "Enter the prefix name" APP_NAME_PREFIX
        APP_NAME_PREFIX=$(echo -n $(make_var_name ${APP_NAME_PREFIX}) && echo "_")
        if confirm yes "Use the new variable name prefix ${APP_NAME_PREFIX}" " ?"; then
            break
        fi
    done
fi

echo
echo "Once the template has been instantiated, the setup_template.sh script and original Makefile will SELF DESTRUCT. Makefile.dist will be moved to become the new Makefile. A new git commit will be made. (If a repository has not been created, this script will run 'git init'.) This process is permanent." | fold -sw 70
echo
confirm yes "Do you wish to proceed" "?"
echo

test -d .git || git init

sed -i "s/FLASK_TEMPLATE_/${APP_NAME_PREFIX}/g" .env-dist docker-compose.yaml Makefile.dist
sed -i "s/FLASK_TEMPLATE/${APP_NAME_VAR}/g" .env-dist docker-compose.yaml Makefile.dist
sed -i "s/flask-template/${APP_DOMAIN}/g" .env-dist Makefile.dist

rm -f Makefile setup_template.sh
git mv Makefile.dist Makefile
git add .
git commit -m "Initial commit for ${APP_NAME} (instantiated from flask-template)"
git log -1 HEAD
