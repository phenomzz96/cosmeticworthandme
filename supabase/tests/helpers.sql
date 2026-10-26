-- Hàm hỗ trợ kiểm thử dùng chung (được \ir từ các file *_test.sql). Chỉ dùng trên Postgres local.
create schema tests;
grant usage on schema tests to anon, authenticated, service_role;

create table tests.results (n serial, label text, ok boolean, info text);
grant insert, select on tests.results to anon, authenticated, service_role;
grant usage on sequence tests.results_n_seq to anon, authenticated, service_role;

create function tests.check(cond boolean, label text, info text default null) returns void
language sql as $$ insert into tests.results (label, ok, info) values (label, coalesce(cond, false), info) $$;

-- Chạy một câu SQL và kiểm tra nó BỊ CHẶN với mã lỗi mong đợi.
create function tests.throws(sql text, expected text, label text) returns void
language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    perform tests.check(sqlstate = expected, label, sqlstate || ': ' || sqlerrm);
    return;
  end;
  perform tests.check(false, label, 'KHÔNG bị chặn (mong đợi lỗi ' || expected || ')');
end $$;

-- Đếm số dòng bị ảnh hưởng bởi một câu lệnh UPDATE/DELETE
create function tests.affected(sql text) returns integer
language plpgsql as $$
declare n integer;
begin
  execute sql;
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

create function tests.summary() returns table (n integer, kq text, label text, chi_tiet text)
language sql as $$ select n, case when ok then 'PASS' else 'FAIL' end, label, coalesce(info, '') from tests.results order by n $$;
