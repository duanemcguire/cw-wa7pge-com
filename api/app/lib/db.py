from psycopg2.pool import SimpleConnectionPool
from contextlib import contextmanager
from dataclasses import dataclass
import psycopg2.extras


## Thanks Bob https://codereview.stackexchange.com/q/257671
@dataclass
class PostgresSimpleConnectionPool:

    pool: SimpleConnectionPool

    @contextmanager
    def connection(self, commit: bool = False, as_dict: bool = False):
        """
        Get connection from the pool.

        commit - if True, auto commit the transaction
        as_dict - if True, return rows as dictionaries instead of lists
        """
        conn = self.pool.getconn()
        try:
            if as_dict:
                yield DictCursorConnection(conn)
            else:
                yield conn
            if commit:
                conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            self.pool.putconn(conn)

    @contextmanager
    def cursor(self, commit: bool = True):
        with self.connection(commit=commit) as conn:
            with conn.cursor() as cur:
                yield cur


class DictCursorConnection:
    """Wrap a real connection, but force cursor_factory=RealDictCursor on .cursor()."""

    def __init__(self, conn):
        self.conn = conn

    def cursor(self):
        return self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    def commit(self):
        return self.conn.commit()

    def rollback(self):
        return self.conn.rollback()

    def close(self):
        return self.conn.close()


#_connection_pool = SimpleConnectionPool(1, 10, "")
#pool = PostgresSimpleConnectionPool(pool=_connection_pool)
#db = pool.connection
