# Journal API — карта эндпоинтов (msapi.top-academy.ru)

База: `https://msapi.top-academy.ru/api/v2`
Файлы: `https://fs.top-academy.ru/api/v1/files/{file_id}` (фото/документы, отдаются прямыми ссылками)

Заголовки запросов:
- `Authorization: Bearer <access_token>` — везде, кроме логина
- `Accept-Language: ru_RU | en_US | es_MX` — язык контента (из настроек сайта)
- `Content-Type: application/json` — для POST

## Аутентификация

| Метод | Эндпоинт | Назначение |
|---|---|---|
| POST | `/auth/login` | Вход. Тело: `{ "application_key": "6a56a5df2667e65aab73ce76d1dd737f7d1faef9c52e8b8c55ac75f565d8e8a6", "id_city": null, "username": "...", "password": "..." }`. Ответ: `access_token`, `refresh_token`, `user_role`, `city_data` (город/колледж, таймзона). JWT живёт 6 часов |
| POST | `/auth/refresh` | Обновление пары токенов. Тело: `{ "refresh_token": "..." }`. Ответ как у логина |
| GET | `/settings/user-info` | Профиль: `full_name`, `student_id`, `group_name`, `current_group_id`, `stream_name`, `level`, `photo`, `gaming_points` (топгемы/топкоины), `visibility` (флаги веток) |

## Главная (дашборд)

| Метод | Эндпоинт | Назначение |
|---|---|---|
| GET | `/count/page-counters?filter_type=0` | Счётчики бейджей меню: type 100 — новые ДЗ, 400 — новые материалы и т.д. |
| GET | `/count/homework` | Счётчики ДЗ: type `0` — просрочено, `1` — проверено, `2` — на проверке, `3` — текущие, `4` — всего |
| GET | `/dashboard/chart/average-progress` | Средний балл по месяцам: `[{date, points, previous_points}]` |
| GET | `/dashboard/chart/attendance` | Посещаемость % по месяцам: `[{date, points, has_rasp}]` |
| GET | `/dashboard/progress/academic-performance` | Средние по категориям: `{totalMonth, totalAllTime, progress: {classwork, homework, laboratory, control, exams, coursework, testing, total}}` |
| GET | `/dashboard/progress/attendance-statistic` | `{statWeek, statMonth, statTotal, diffWeek, diffMonth}` — посещаемость |
| GET | `/dashboard/progress/leader-group` | Топ группы: `[{id, full_name, photo_path, position, amount}]` |
| GET | `/dashboard/progress/leader-stream` | Топ потока |
| GET | `/dashboard/progress/leader-group-points` | `{totalCount, studentPosition, weekDiff, monthDiff}` — место студента |
| GET | `/dashboard/info/future-exams` | Ближайшие экзамены |
| GET | `/dashboard/progress/activity` | Лента наград/активности (топгемы за оценки, посещения) |

## Расписание

| Метод | Эндпоинт | Назначение |
|---|---|---|
| GET | `/schedule/operations/get-by-date?date_filter=YYYY-MM-DD` | Пары за день: `[{date, lesson, started_at, finished_at, teacher_name, subject_name, room_name}]` |
| GET | `/schedule/operations/get-by-date-range?date_from=...&date_to=...` | Пары за период (неделя) |
| GET | `/schedule/operations/get-month?date_filter=YYYY-MM-DD` | Пары за месяц |
| GET | `/schedule/operations/month-events?date_filter=...` | События месяца |

## Домашние задания и лабораторные

| Метод | Эндпоинт | Назначение |
|---|---|---|
| GET | `/homework/operations/list?page=&status=&type=&group_id=&spec_id=` | Пагинация по 6 шт. `type`: `0` — ДЗ, `1` — лабораторные. `status`: `3` — текущие, `2` — на проверке, `1` — проверено, `0` — просрочено (без параметра — свежая смесь). `spec_id` — фильтр по предмету |
| GET | `/homework/settings/group-history` | Словарь: группы `[{id, name, specs: [{id, name, short_name, subject_id, subject_source}]}]` |
| POST | `/homework/operations/has-material` | `{id}` — есть ли доп. материал у ДЗ |
| POST | `/homework/operations/create` / `delete` | Сдача/удаление работы (в новом фронте не используется) |

Элемент списка: `{id, theme, name_spec, fio_teach, creation_time, completion_time, overdue_time, file_path, comment, status, cover_image, homework_stud: {mark, auto_mark, file_path, creation_time, stud_answer}}`.

## Учебные материалы (библиотека)

| Метод | Эндпоинт | Назначение |
|---|---|---|
| GET | `/library/operations/list?material_type=1..8&recommended_type=1` | Материалы. Типы: `1` ДЗ-материалы, `2` уроки, `3` лабораторные, `4` книги, `5` видео, `6` презентации, `7` тесты, `8` статьи |
| GET | `/count/library` | Количество материалов/новых по каждому типу |
| POST | `/library/operations/set-use-material` | `{id}` — отметить «материал использован» |
| GET | `/material/operations/get-material` | Детали материала |

Элемент: `{material_id, theme, description, url, link, download_url, filename, cover_image, date, id_spec, subject_id, subject_source, material_type, is_new_material, accessibility: {response_code, last_check}}`.

## Оценки и посещаемость

| Метод | Эндпоинт | Назначение |
|---|---|---|
| GET | `/progress/operations/student-visits` | Все занятия: `{date_visit, lesson_number, status_was (1 был / 0 не был), spec_name, teacher_name, lesson_theme, control_work_mark, home_work_mark, lab_work_mark, class_work_mark, practical_work_mark, final_work_mark}` |
| GET | `/progress/operations/student-exams` | Экзамены: `{teacher, mark, mark_type, date, spec, attestation_type, ...}` |
| GET | `/progress/operations/school-quarterly-grades` | Четвертные оценки (для школ) |

## Оценивание занятий (обратная связь)

| Метод | Эндпоинт | Назначение |
|---|---|---|
| GET | `/feedback/students/evaluate-lesson-list` | Занятия, ожидающие оценки: `[{key, date_visit, fio_teach, spec_name, teach_photo}]` |
| POST | `/feedback/students/evaluate-lesson` | Поставить оценку: `{key, mark_lesson: 1..5, mark_teach: 1..5, comment_lesson, comment_teach, tags_lesson: [], tags_teach: []}` → 200. При низкой оценке API требует комментарий |
| GET | `/public/tags?type=evaluation_lesson_teach` | Теги преподавателя: 8 «всё супер», 9 «не отвечал на вопросы», 10 «понятно объясняет», 11 «классный преподаватель», 12 «было шумно», 13 «тема не объяснена», 14 «преподаватель кричит» |
| GET | `/public/tags?type=evaluation_lesson` | Теги занятия (15 «всё супер», 16 «сложно», 17 «скучно», …) |

## Локализация

| Метод | Эндпоинт | Назначение |
|---|---|---|
| GET | `/public/languages` | Доступные языки: `ru_RU`, `en_US`, `es_MX` |
| GET | `/public/translations?language=ru` | Словарь переводов оригинального сайта (~2600 ключей) |

## Прочее (в новом фронте сознательно не используется)

- `news/operations/*` — вкладка «Объявления» (удалена по требованию)
- `story/operations/*` — сторис/рекламные баннеры (удалены)
- `payment/operations/*`, `individual/*` — оплата
- `market/*` — маркет
- `signal/*` — сигналы
- `referral/*` — реферальная программа
- `vacancy/*`, `contacts/*`, `complaints/*` — вакансии, контакты, жалобы
- Ссылки-реклама «MAX» (max.ru) и «Классно!» (myclass.team) в сайдбаре — удалены

## Особенность защиты (важно для прокси)

API закрыт DDoS-Guard: обычные HTTP/1.1-запросы из Node блокируются (403), но:
- GET и авторизованные POST проходят по **HTTP/2** (`node:http2`);
- `/auth/login` и `/auth/refresh` (неавторизованные POST) проходят по **HTTP/1.1** (`node:https`).

Поэтому dev-прокси в `vite.config.js` использует гибридную схему: данные — h2, авторизация — h1.1, с взаимным фолбэком.
