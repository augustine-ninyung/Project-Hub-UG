-- Default project categories. Admins can rename, add or remove categories later
-- in the admin dashboard; existing categories with the same name or slug are kept.
INSERT INTO "Category" ("id", "name", "slug", "description", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'Web Development', 'web-development', 'Websites, web apps and APIs', now(), now()),
  (gen_random_uuid(), 'Mobile Development', 'mobile-development', 'Android, iOS and cross-platform apps', now(), now()),
  (gen_random_uuid(), 'Artificial Intelligence', 'artificial-intelligence', 'Intelligent agents, NLP and computer vision', now(), now()),
  (gen_random_uuid(), 'Machine Learning', 'machine-learning', 'Models, training pipelines and experiments', now(), now()),
  (gen_random_uuid(), 'Cybersecurity', 'cybersecurity', 'Security tools, research and CTF writeups', now(), now()),
  (gen_random_uuid(), 'Data Science', 'data-science', 'Analysis, visualisation and dashboards', now(), now()),
  (gen_random_uuid(), 'UI/UX Design', 'ui-ux-design', 'Interface design, prototypes and case studies', now(), now()),
  (gen_random_uuid(), 'Internet of Things', 'internet-of-things', 'Connected devices and embedded systems', now(), now()),
  (gen_random_uuid(), 'Robotics', 'robotics', 'Robots, drones and automation', now(), now()),
  (gen_random_uuid(), 'Other', 'other', 'Everything else worth sharing', now(), now())
ON CONFLICT DO NOTHING;