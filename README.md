# flask-template

This is an example [Flask](https://flask.palletsprojects.com/) project
template.

## Features

 * Uses a Makefile to wrap all setup, installation, and maintainance tasks.
 
 * Uses [d.rymcg.tech](https://github.com/EnigmaCurry/d.rymcg.tech) to
   deploy to Docker with `docker compose`, which follows the
   [12-factor philosophy on
   configuration](https://12factor.net/config), keeping all
   configuration inside separate `.env` files, per instance.
   
 * Each instance includes its own PostgreSQL database, running as an
   optional sidecar container (but you could use an external/hosted
   database instead).

 * Provides a local development environment using Python's
   [virtualenv](https://docs.python.org/3/library/venv.html) (native;
   not in Docker). The local dev service can access the same remote
   database as your public (DEV/STAGING) deployment, running on your
   server. Local database access is [provisioned via SSH
   tunnel](https://github.com/EnigmaCurry/d.rymcg.tech/blob/master/_scripts/postgresql-tunnel),
   which can be used by any desktop or terminal PostgreSQL client
   program.

 * Uses [Flask
   Blueprints](https://flask.palletsprojects.com/en/3.0.x/blueprints/)
   for a modular project design.

 * All database SQL queries are stored in separate `.sql` files, never
   in Python code. These queries are loaded as dynamic Python
   functions, using [aiosql](https://nackjicholson.github.io/aiosql/).
   The ability to test your SQL code in isolation is a significant
   feature, not to be missed!

 * Uses [alembic](https://alembic.sqlalchemy.org/en/latest/) for
   database migration support.

 * OpenAPI spec for JSON APIs via
   [flask-openapi3](https://github.com/luolingchun/flask-openapi3).

## How to use this template

This example project integrates with
[d.rymcg.tech](https://github.com/EnigmaCurry/d.rymcg.tech#readme).
Before proceeding, you must first clone and setup `d.rymcg.tech` on
your workstation. 

Clone this project to anyplace you like, naming it something new
(replace `foo` with your new project name):

```
git clone https://github.com/EnigmaCurry/flask-template.git foo
cd foo
```

This project is an example of a so-called
["external"](https://github.com/enigmacurry/d.rymcg.tech#integrating-external-projects)
project to `d.rymcg.tech`, as it does not live in the same source tree
as `d.rymcg.tech`, but it makes a link to inherit its Makefiles and to
gain its superpowers. At the top of the Makefile, you should see
`ROOT_DIR` that points to the main d.rymcg.tech directory.

### Rename variables

By default, all the variables in the config are prefixed with the name
`FLASK_TEMPLATE`. You should change all of these variable names in the
following places:

 * [.env-dist](.env-dist) - rename all variables with a new prefix
   (eg. change every `FLASK_TEMPLATE_` to `FOO_`).
 * [docker-compose.yaml](docker-compose.yaml) - rename all variables
   according to [.env-dist](.env-dist).
 * [Makefile](Makefile) - rename all variables according to
   [.env-dist](.env-dist) especially in the `override-hook` section.

## Example blueprints

This example template comes with the following Flask blueprints:

 * hello - a simple greeting and visitor log application
 
   * [hello route](api/app/routes/hello)
   * [hello model](api/app/models/hello)
   * [hello templates](api/app/templates/hello) 

 * upload - a simple file upload form
 
   * [upload route](api/app/routes/upload)
   * [upload model](api/app/models/upload)
   * [upload templates](api/app/templates/upload)

 * book - a JSON API with OpenAPI spec
   
   * [book route](api/app/routes/book)
   * OpenAPI docs site live at `/openapi`

## Configure

Once
[d.rymcg.tech](https://github.com/EnigmaCurry/d.rymcg.tech#readme) has
been configured, and you have Traefik deployed, you can come back to
this directory.

Run:

```
make config
```

This will create the `.env_{DOCKER_CONTEXT}` configuration file for
your service.

## Install

Run:

```
make install
```

## Run alembic migration to create initial database schema

Run:

```
make migrate-db
```

## Open in your web browser

Run:

```
make open
```

## Unit tests

There is a separate containers for the unit tests: `api-tests` and
`database-test`.

To run tests, run: `make test`

## Local Database

To access the database directly from your workstation, run:

```
make local-db
```

This starts an SSH tunnel to the postgres port inside the container,
enters you into a BASH subshell, and sets all of the environment
variables to accessing the database using local postgres tools and
clients.

On Arch linux, you want to install the postgres client package: `sudo pacman -S postgresql-libs`

On Ubuntu: `sudo apt-get install -y postgresql-client libpq-dev python3-dev`

On Fedora: `sudo dnf install python3.11 python3.11-devel postgresql libpq-devel`

Inside the `make local-db` shell, you can run any of the standard
postgresql client tools: `psql`, `createdb`, `createuser`, `pg_dump`,
etc. The user credentials are pre-set in your environment for easy
access.

Notice the PGPORT setting. When using the tunnel, this port is on
`localhost`. You can use any other postgresql client connecting to
`localhost` on the given port. By default the port is randomly chosen
upon entering the subshell. To get the same port everytime, add it as
an argument:

```
## Specify a static TCP port:
make local-db PGPORT=55542
```

Keep this shell open, and you can use graphical client like
[DBeaver](https://dbeaver.io/) (when creating the connection in
DBeaver make sure to copy all the settings for host, port, database,
user, and password, as shown in the subshell session.)

## Local development mode

You can install a Python virtual environment (`virtualenv`) for local
development mode. This virtualenv does not run in a container, but it
require you to install the remote database service.

Ensure you have installed the postgres dependencies listed in the
prior section (python3.11, python3.11-devel, libpq-devel).

Ensure that you have installed the remote database:

```
make install service=database
```

Install the local virtualenv:

```
make local-install
```

To start the local development server, you must first start the
`local-db` connection. Enter the `local-db` shell:

```
make local-db
```

Once inside the `local-db` shell, you can start the local server:

```
## This only works inside the local-db shell:
make dev
```

## Add database migrations scripts

To add additional database migration scripts to accomodate an evolving
schema, you need to add new scripts to the `api/alembic/versions`
directory. To make this easy, you can use the `alembic` CLI program,
which is available in the local development virtualenv.

 * Follow the steps in the prior section (`make local-install`)
 * Activate the local virtualenv (`make local-activate`)
 * `cd api`
 * Follow the [alembic
   tutorial](https://alembic.sqlalchemy.org/en/latest/tutorial.html#create-a-migration-script)
   to create a migration script, e.g.:
   * `alembic revision -m "add new tables"`
   * Follow the example in
     [init_ddl.py](api/alembic/versions/f25d1dab29bf_init_ddl.py)
   * Add sql to a file with the same name and the extension `.sql`.
     Make sure to reference this sql script in your python migration.
   * Rebuild the image and install: `make install`.
   * Run the full migration on the live database: `make migrate-db`.
   * Find the current migration of the database: `make migrate-info`.
     (this should list the id of the latest migration applied.)
     
## Instantiation

If you wish to run more than one instance of the app on the same
docker host, you can use `make instance`. Follow the the main
[d.rymcg.tech instantiation
docs](https://github.com/EnigmaCurry/d.rymcg.tech#creating-multiple-instances-of-a-service)
for details.

Each instance is a separate stack. Each separate instance has:

 * Its own `.env_{DOCKER_CONTEXT}_{INSTANCE_NAME}` config file.
 * Its own frontend, API, database, etc. services.
 * It's own domain name.

In the `.env_{DOCKER_CONTEXT}_{INSTANCE_NAME}` config file, each
instance has set a unique `{PROJECT}_INSTANCE` variable. This variable
is used to make discrete Traefik services, routes, and middlewares,
separate for each instance.

This could be useful for having a "production" and "development"
instance on the same box (at the risk of the integrity of the
"production" instance, if you choose to do this).
