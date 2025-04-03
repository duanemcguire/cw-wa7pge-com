-- name: create_table_visitor#
create table if not exists visitor (
  encounter bigserial not null primary key,
  name varchar not null,
  salutation varchar not null,
  ip_address varchar not null
);

-- name: create_index_visitor_name#
create index if not exists visitor_name_idx on visitor ("name");
