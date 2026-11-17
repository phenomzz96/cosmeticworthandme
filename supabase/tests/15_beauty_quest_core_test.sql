-- =============================================================================
-- KIỂM THỬ MIGRATION 015 (Beauty Quest chạy trong Worth & Me)
--   00_local_supabase_stub.sql → migrations 001..015 → file này
-- =============================================================================
\set ON_ERROR_STOP on

\ir helpers.sql

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('24000000-0000-0000-0000-0000000000aa', 'super@example.com', now(), '{}'),
  ('24000000-0000-0000-0000-0000000000a1', 'admin1@example.com', now(), '{}'),
  ('24000000-0000-0000-0000-0000000000d1', 'khach@example.com', now(), '{}'),
  ('24000000-0000-0000-0000-0000000000d2', 'khach2@example.com', now(), '{}'),
  ('24000000-0000-0000-0000-0000000000d3', 'bikhoa@example.com', now(), '{}');
select public.bootstrap_super_admin('super@example.com');
update public.profiles set role = 'admin' where email = 'admin1@example.com';
update public.profiles set status = 'suspended' where email = 'bikhoa@example.com';

create table tests.ctx (k text primary key, v text);
grant all on tests.ctx to authenticated, anon;

-- ---------------------------------------------------------------- Khách vãng lai, tài khoản bị khóa
begin;
set local role anon;
select tests.check((select count(*) from public.bq_quests) = 9, 'Khách vãng lai xem được danh sách nhiệm vụ');
select tests.check((select count(*) from public.bq_achievements) = 6, 'Khách vãng lai xem được danh sách thành tích');
select tests.throws($q$select public.bq_state()$q$, '42501', 'Khách vãng lai KHÔNG gọi được hàm Beauty Quest');
select tests.throws($q$select * from public.bq_diary$q$, '42501', 'Khách vãng lai KHÔNG đọc nhật ký da');
select tests.check(public.bq_current_week() ~ '^\d{4}-W\d{2}$', 'Tuần hiện tại theo giờ Việt Nam');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '24000000-0000-0000-0000-0000000000d3';
select tests.throws($q$select public.bq_state()$q$, '42501', 'Tài khoản bị khóa KHÔNG dùng được Beauty Quest');
commit;

-- ---------------------------------------------------------------- Trạng thái ban đầu, không tự cộng điểm
begin;
set local role authenticated;
set local request.jwt.claim.sub = '24000000-0000-0000-0000-0000000000d1';
select tests.check((public.bq_state() ->> 'points')::integer = 0, 'Bắt đầu với 0 điểm');
select tests.check((select bool_and(not (x ->> 'ready')::boolean) from jsonb_array_elements(public.bq_state() -> 'quests') x), 'Chưa làm gì: không nhiệm vụ nào đủ điều kiện');
select tests.throws($q$select public.bq_claim('first_glow')$q$, '22023', 'Nhận điểm khi chưa làm Skin Quiz bị từ chối');
select tests.throws($q$insert into public.bq_events (user_id, type, day, week) values (auth.uid(), 'quiz', current_date, 'x')$q$, '42501', 'KHÔNG tự ghi sự kiện');
select tests.throws($q$update public.bq_progress set points = 9999$q$, '42501', 'KHÔNG tự sửa điểm');
select tests.throws($q$insert into public.bq_user_quests (user_id, quest_id, period_key, day, points) values (auth.uid(), 'first_glow', 'once', current_date, 100)$q$, '42501', 'KHÔNG tự thêm nhiệm vụ đã xong');
select tests.throws($q$select private.bq_claim(auth.uid(), 'first_glow')$q$, '42501', 'KHÔNG gọi hàm nội bộ');
commit;

-- ---------------------------------------------------------------- Skin Quiz
begin;
set local role authenticated;
set local request.jwt.claim.sub = '24000000-0000-0000-0000-0000000000d1';
select tests.throws($q$select public.bq_submit_quiz('{"after_wash":"tight"}')$q$, '22023', 'Thiếu câu trả lời bị từ chối');
select tests.throws($q$select public.bq_submit_quiz('{"after_wash":"tight","midday":"flaky","reactive":"often","concerns":["acne","spots","hydrate","pores"],"time":"long","sun":"daily"}')$q$, '22023', 'Chọn quá 3 mối quan tâm bị từ chối');
select tests.throws($q$select public.bq_submit_quiz('{"after_wash":"hack","midday":"flaky","reactive":"often","concerns":["acne"],"time":"long","sun":"daily"}')$q$, '22023', 'Đáp án lạ bị từ chối');
insert into tests.ctx values ('quiz', public.bq_submit_quiz('{"after_wash":"shiny","midday":"all","reactive":"often","concerns":["acne","spots"],"time":"normal","sun":"sometimes"}')::text);
commit;
select tests.check((select v::jsonb #>> '{result,skin_type}' from tests.ctx where k = 'quiz') = 'oily', 'Quiz: bóng dầu khắp mặt + bóng toàn mặt → Da dầu');
select tests.check((select (v::jsonb #>> '{result,sensitive}')::boolean from tests.ctx where k = 'quiz'), 'Quiz: hay đỏ/châm chích → dễ phản ứng');
select tests.check((select v::jsonb #> '{result,suggested,morning}' from tests.ctx where k = 'quiz') = '["cleanser","serum","moisturizer","sunscreen"]'::jsonb, 'Quiz: routine sáng gợi ý đúng thứ tự (có serum vì quan tâm thâm)');
select tests.check((select v::jsonb #> '{result,suggested,night}' from tests.ctx where k = 'quiz') = '["remover","cleanser","treatment","moisturizer"]'::jsonb, 'Quiz: routine tối có tẩy trang + đặc trị');
select tests.check((select v::jsonb #>> '{claim,claimed,0,id}' from tests.ctx where k = 'quiz') = 'first_glow', 'Làm Quiz xong tự nhận First Glow');
select tests.check((select points from public.bq_progress where user_id = '24000000-0000-0000-0000-0000000000d1') = 20, '+20 điểm');
select tests.check((select count(*) from public.bq_user_achievements where user_id = '24000000-0000-0000-0000-0000000000d1' and achievement_id = 'first_step') = 1, 'Mở khóa thành tích First Step');
begin;
set local role authenticated;
set local request.jwt.claim.sub = '24000000-0000-0000-0000-0000000000d1';
select tests.throws($q$select public.bq_claim('first_glow')$q$, '23505', 'Nhận First Glow lần hai bị từ chối');
select public.bq_submit_quiz('{"after_wash":"tight","midday":"flaky","reactive":"rare","concerns":["hydrate"],"time":"quick","sun":"daily"}');
select tests.check((select result ->> 'skin_type' from public.bq_quiz_results) = 'dry', 'Làm lại quiz: cập nhật kết quả (Da khô)');
commit;
select tests.check((select points from public.bq_progress where user_id = '24000000-0000-0000-0000-0000000000d1') = 20, 'Làm lại quiz không cộng điểm lần nữa');

-- ---------------------------------------------------------------- Routine + check-in
begin;
set local role authenticated;
set local request.jwt.claim.sub = '24000000-0000-0000-0000-0000000000d1';
select tests.throws($q$select public.bq_checkin('morning')$q$, '22023', 'Check-in khi chưa lưu routine bị từ chối');
select tests.throws($q$select public.bq_save_routine(array['hack'], array[]::text[])$q$, '22023', 'Routine chỉ có bước lạ bị từ chối');
insert into tests.ctx values ('rt', public.bq_save_routine(array['sunscreen', 'cleanser', 'hack'], array['moisturizer'])::text);
select tests.check((select v::jsonb #> '{routine,morning}' from tests.ctx where k = 'rt') = '["cleanser","sunscreen"]'::jsonb, 'Routine: bỏ bước lạ, giữ đúng thứ tự');
select tests.check((select v::jsonb #>> '{claim,claimed,0,id}' from tests.ctx where k = 'rt') = 'routine_ready', 'Lưu routine tự nhận Routine Ready (+30)');
select tests.check((public.bq_checkin('morning') #>> '{claim,claimed,0,id}') = 'morning_ritual', 'Check-in sáng → Morning Ritual (+5)');
select tests.check(jsonb_array_length(public.bq_checkin('morning') #> '{claim,claimed}') = 0, 'Check-in sáng lần hai trong ngày không cộng điểm');
commit;

-- ---------------------------------------------------------------- Bài học, tự đánh giá, Glow Match, nhật ký
begin;
set local role authenticated;
set local request.jwt.claim.sub = '24000000-0000-0000-0000-0000000000d1';
select tests.throws($q$select public.bq_mark_read('khong-co-bai-nay')$q$, 'P0002', 'Đánh dấu bài không tồn tại bị từ chối');
select tests.check(jsonb_array_length(public.bq_mark_read('rua-mat-dung-cach') #> '{claim,claimed}') = 2, 'Đọc bài đầu tiên: Mẹo da mỗi ngày + Knowledge Quest');
select tests.throws($q$select public.bq_save_reflection('{"skin":6,"routine":3,"rest":3}', '{}')$q$, '22023', 'Tự đánh giá ngoài 1–5 bị từ chối');
select tests.throws($q$select public.bq_save_reflection('{"skin":"3.5","routine":3,"rest":3}', '{}')$q$, '22023', 'Tự đánh giá số lẻ bị từ chối');
select tests.check((public.bq_save_reflection('{"skin":4,"routine":3,"rest":5}', '{"win":"Uống đủ nước","next":"Ngủ sớm hơn"}') #>> '{claim,claimed,0,id}') = 'weekly_reflection', 'Tự đánh giá tuần → Weekly Reflection (+20)');
select tests.throws($q$select public.bq_answer_game('texture', 'hack')$q$, '22023', 'Glow Match: lựa chọn lạ bị từ chối');
select public.bq_answer_game('texture', 'gel'); select public.bq_answer_game('steps', 'short'); select public.bq_answer_game('focus', 'acne');
select public.bq_answer_game('time', 'both'); select public.bq_answer_game('learn', 'tips');
select tests.check((public.bq_answer_game('scent', 'none') #>> '{claim,claimed,0,id}') = 'glow_match', 'Glow Match đủ 6 câu → +15');
select tests.throws($q$select public.bq_save_diary('happy', '')$q$, '22023', 'Nhật ký: tình trạng lạ bị từ chối');
select tests.throws($q$select public.bq_save_diary('balanced', '', '24000000-0000-0000-0000-0000000000d2/anh.jpg')$q$, '22023', 'Nhật ký: KHÔNG gắn ảnh thư mục người khác');
select tests.throws($q$select public.bq_save_diary('balanced', '', '24000000-0000-0000-0000-0000000000d1/chua-tai.jpg')$q$, '22023', 'Nhật ký: ảnh chưa tải lên bị từ chối');
insert into storage.objects (bucket_id, name, owner) values ('bq-diary', '24000000-0000-0000-0000-0000000000d1/hom-nay.jpg', auth.uid());
select tests.check((public.bq_save_diary('balanced', 'Da ổn', '24000000-0000-0000-0000-0000000000d1/hom-nay.jpg') #>> '{claim,claimed,0,id}') = 'skin_diary', 'Ghi nhật ký kèm ảnh → Nhật ký da (+5)');
select tests.check((public.bq_save_diary('dry', 'Hơi khô', null, true) ->> 'removed_photo') = '24000000-0000-0000-0000-0000000000d1/hom-nay.jpg', 'Gỡ ảnh: trả về đường dẫn ảnh cũ để xóa khỏi bucket');
select tests.check((select count(*) from public.bq_diary) = 1 and (select mood from public.bq_diary) = 'dry', 'Mỗi ngày một mục, sửa được trong ngày');
select tests.check((public.bq_state() ->> 'points')::integer = 20 + 30 + 5 + 5 + 10 + 20 + 15 + 5, 'Tổng điểm đúng: 110');
select tests.check((public.bq_state() ->> 'level')::integer = 1, 'Lên cấp 2 (Nụ hoa) khi ≥ 50 điểm');
select tests.check((public.bq_state() #>> '{streak,current}')::integer = 1 and (public.bq_state() #>> '{streak,active_today}')::boolean, 'Chuỗi ngày: hôm nay có hoạt động');
select tests.check((select count(*) from public.bq_history()) = 8 and (select count(*) from public.bq_history('daily')) = 3, 'Lịch sử nhiệm vụ lọc theo loại');
commit;
select tests.check((select count(*) from public.bq_user_achievements where user_id = '24000000-0000-0000-0000-0000000000d1' and achievement_id = 'glow_starter') = 1, 'Đạt 50 điểm → Glow Starter');

-- Chuỗi ngày: được nghỉ 1 ngày giữa chừng
insert into public.bq_user_quests (user_id, quest_id, period_key, day, points) values
  ('24000000-0000-0000-0000-0000000000d1', 'daily_tip', (private.bq_today() - 2)::text, private.bq_today() - 2, 5),
  ('24000000-0000-0000-0000-0000000000d1', 'daily_tip', (private.bq_today() - 3)::text, private.bq_today() - 3, 5),
  ('24000000-0000-0000-0000-0000000000d1', 'daily_tip', (private.bq_today() - 9)::text, private.bq_today() - 9, 5);
select tests.check((private.bq_streak('24000000-0000-0000-0000-0000000000d1') ->> 'current')::integer = 3, 'Chuỗi ngày giữ nguyên khi nghỉ 1 ngày (−3, −2, hôm nay)');

-- ---------------------------------------------------------------- Riêng tư giữa người dùng
begin;
set local role authenticated;
set local request.jwt.claim.sub = '24000000-0000-0000-0000-0000000000d2';
select tests.check((select count(*) from public.bq_diary) + (select count(*) from public.bq_quiz_results) + (select count(*) from public.bq_reflections)
                 + (select count(*) from public.bq_game_answers) + (select count(*) from public.bq_point_transactions) + (select count(*) from public.bq_events) = 0,
  'Người khác KHÔNG thấy nhật ký, kết quả quiz, tự đánh giá, Glow Match, điểm của khách');
select tests.check((select count(*) from storage.objects where bucket_id = 'bq-diary') = 0, 'Người khác KHÔNG thấy ảnh nhật ký');
select tests.throws($q$insert into storage.objects (bucket_id, name) values ('bq-diary', '24000000-0000-0000-0000-0000000000d1/gia-mao.jpg')$q$, '42501', 'KHÔNG tải ảnh vào thư mục người khác');
select tests.check(public.bq_delete_diary((now() at time zone 'Asia/Ho_Chi_Minh')::date) is null, 'KHÔNG xóa được nhật ký của người khác');
select tests.check((public.bq_state() ->> 'points')::integer = 0, 'Mỗi tài khoản có tiến trình riêng');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '24000000-0000-0000-0000-0000000000a1';
select tests.check((select count(*) from public.bq_diary) = 0 and (select count(*) from public.bq_quiz_results) = 0, 'Admin cũng KHÔNG đọc nhật ký / kết quả quiz của khách');
commit;

-- ---------------------------------------------------------------- Quản trị
begin;
set local role authenticated;
set local request.jwt.claim.sub = '24000000-0000-0000-0000-0000000000d1';
select tests.throws($q$select public.bq_admin_save_quest('hack', 'Hack', '', '🌸', 100, 'daily', 'quiz', 'quiz', true)$q$, '42501', 'Khách KHÔNG sửa nhiệm vụ');
select tests.throws($q$select public.bq_admin_stats()$q$, '42501', 'Khách KHÔNG xem thống kê');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '24000000-0000-0000-0000-0000000000a1';
select tests.throws($q$select public.bq_admin_save_quest('Sai ID', 'X', '', '🌸', 5, 'daily', 'quiz', 'quiz', true)$q$, '22023', 'ID nhiệm vụ sai định dạng bị từ chối');
select tests.throws($q$select public.bq_admin_save_quest('qua_nhieu', 'X', '', '🌸', 500, 'daily', 'quiz', 'quiz', true)$q$, '23514', 'Điểm > 100 bị từ chối');
select tests.throws($q$select public.bq_admin_save_quest('sai_loai', 'X', '', '🌸', 5, 'daily', 'quiz', 'hack_event', true)$q$, '23514', 'Điều kiện lạ bị từ chối');
select public.bq_admin_save_quest('daily_tip', 'Mẹo da mỗi ngày', 'Đọc một mẹo chăm da ngắn.', '💡', 5, 'daily', 'knowledge', 'article_read', false);
select tests.check((public.bq_admin_stats() ->> 'quiz_done')::integer = 1 and (public.bq_admin_stats() -> 'game' ->> 'texture:gel')::integer = 1, 'Admin xem số liệu tổng hợp ẩn danh');
commit;
select tests.check((select count(*) from public.audit_logs where action = 'bq_quest.save') = 1, 'Sửa nhiệm vụ được ghi nhật ký');
begin;
set local role anon;
select tests.check((select count(*) from public.bq_quests) = 8, 'Nhiệm vụ đang tắt không hiện cho khách');
commit;

-- ---------------------------------------------------------------- Nối với Hộp quà: Beauty Points → lượt mở hộp
begin;
set local role authenticated;
set local request.jwt.claim.sub = '24000000-0000-0000-0000-0000000000a1';
insert into tests.ctx values ('camp', public.admin_save_reward_campaign(null, 'Đợt thử', '', '', now() - interval '1 day', now() + interval '7 days', 1, 0, true, 50));
select tests.throws($q$select public.admin_save_reward_campaign(null, 'Sai', '', '', now(), now() + interval '1 day', 1, 0, true, 5000)$q$, '23514', 'Điểm đổi lượt quá lớn bị từ chối');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '24000000-0000-0000-0000-0000000000d1';
select tests.check((public.reward_turns((select v::uuid from tests.ctx where k = 'camp')) ->> 'quest_bonus')::integer = 2, '110 Beauty Points trong đợt quà → +2 lượt (50 điểm / lượt)');
select tests.check((public.reward_turns((select v::uuid from tests.ctx where k = 'camp')) ->> 'remaining')::integer = 3, 'Tổng lượt = 1 lượt/ngày + 2 lượt thưởng');
commit;

-- ---------------------------------------------------------------- Xóa dữ liệu của tôi
begin;
set local role authenticated;
set local request.jwt.claim.sub = '24000000-0000-0000-0000-0000000000d1';
select public.bq_delete_my_data();
select tests.check((select count(*) from public.bq_point_transactions) + (select count(*) from public.bq_diary) + (select count(*) from public.bq_quiz_results) = 0, 'Xóa toàn bộ dữ liệu Beauty Quest của tôi');
select tests.check((public.bq_state() ->> 'points')::integer = 0, 'Sau khi xóa: bắt đầu lại từ 0');
commit;

select * from tests.summary();
select count(*) filter (where ok) || '/' || count(*) as "KẾT QUẢ" from tests.results;
