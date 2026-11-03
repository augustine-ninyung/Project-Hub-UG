/**
 * Development seed: realistic users, categories, technologies, projects (with
 * generated cover images stored through the configured storage provider),
 * contributors, likes, threaded comments and notifications.
 *
 * WARNING: clears all existing data first. Refuses to run in production.
 *
 * All seeded students use the password "Password123".
 * Admin: admin@studenthub.dev / Admin12345
 */
import { PrismaClient, type ProjectStatus } from '@prisma/client';
import argon2 from 'argon2';
import { storeImageBuffer } from '../src/services/storage.service.js';
import { slugify } from '../src/utils/common-schemas.js';

if (process.env.NODE_ENV === 'production' && process.env.SEED_FORCE !== 'true') {
  console.error('Refusing to seed a production database (set SEED_FORCE=true to override).');
  process.exit(1);
}

const prisma = new PrismaClient();

// Deterministic PRNG so every seed run produces the same data shape.
let state = 42;
const rand = () => {
  state = (state * 1664525 + 1013904223) % 2 ** 32;
  return state / 2 ** 32;
};
const pick = <T>(items: T[]) => items[Math.floor(rand() * items.length)]!;
const sample = <T>(items: T[], n: number) =>
  [...items].sort(() => rand() - 0.5).slice(0, Math.min(n, items.length));
const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000 - rand() * 3_600_000);

const CATEGORIES = [
  ['Web Development', 'Websites, web apps and APIs'],
  ['Mobile Development', 'Android, iOS and cross-platform apps'],
  ['Artificial Intelligence', 'Intelligent agents, NLP and computer vision'],
  ['Machine Learning', 'Models, training pipelines and experiments'],
  ['Cybersecurity', 'Security tools, research and CTF writeups'],
  ['Data Science', 'Analysis, visualisation and dashboards'],
  ['UI/UX Design', 'Interface design, prototypes and case studies'],
  ['Internet of Things', 'Connected devices and embedded systems'],
  ['Robotics', 'Robots, drones and automation'],
  ['Other', 'Everything else worth sharing'],
] as const;

const PALETTE = ['#0f766e', '#1d4ed8', '#7c2d12', '#4338ca', '#be123c', '#15803d', '#a16207', '#0e7490', '#6d28d9', '#334155'];

const USERS = [
  { fullName: 'Kwame Asante', username: 'kwame_dev', university: 'University of Ghana', department: 'Computer Science', bio: 'Full-stack developer who loves building tools for students. Currently exploring distributed systems.', skills: ['React', 'Node.js', 'PostgreSQL', 'Docker'] },
  { fullName: 'Ama Owusu', username: 'ama_codes', university: 'KNUST', department: 'Computer Engineering', bio: 'Embedded systems and IoT enthusiast. I like making hardware talk to the cloud.', skills: ['C++', 'Arduino', 'MQTT', 'Python'] },
  { fullName: 'Yaw Boateng', username: 'yawml', university: 'Ashesi University', department: 'Computer Science', bio: 'ML research assistant working on low-resource language models for Twi and Ga.', skills: ['PyTorch', 'NLP', 'Python', 'Hugging Face'] },
  { fullName: 'Efua Mensah', username: 'efua_designs', university: 'University of Ghana', department: 'Information Technology', bio: 'Product designer. I care about accessible, inclusive interfaces.', skills: ['Figma', 'User Research', 'Prototyping', 'Design Systems'] },
  { fullName: 'Kofi Adjei', username: 'kofisec', university: 'University of Cape Coast', department: 'Computer Science', bio: 'CTF player and aspiring penetration tester. Breaking things responsibly.', skills: ['Python', 'Burp Suite', 'Linux', 'Network Security'] },
  { fullName: 'Abena Darko', username: 'abena_data', university: 'KNUST', department: 'Statistics', bio: 'Data scientist who enjoys turning messy public datasets into clear stories.', skills: ['Pandas', 'R', 'Tableau', 'SQL'] },
  { fullName: 'Chidi Okafor', username: 'chidi_builds', university: 'University of Lagos', department: 'Electrical Engineering', bio: 'Robotics club lead. Building autonomous rovers on a student budget.', skills: ['ROS', 'C++', 'OpenCV', 'SolidWorks'] },
  { fullName: 'Zainab Bello', username: 'zainab_mobile', university: 'Ahmadu Bello University', department: 'Software Engineering', bio: 'Mobile developer shipping Flutter apps for local businesses.', skills: ['Flutter', 'Dart', 'Firebase', 'Kotlin'] },
  { fullName: 'Nana Akua Frimpong', username: 'nana_akua', university: 'Ashesi University', department: 'Management Information Systems', bio: 'Interested in fintech and building products for the informal economy.', skills: ['Next.js', 'TypeScript', 'Product Management'] },
  { fullName: 'Daniel Tetteh', username: 'dtetteh', university: 'University of Ghana', department: 'Mathematics', bio: 'Competitive programmer and algorithms nerd.', skills: ['C++', 'Algorithms', 'Go'] },
];

interface SeedProject {
  owner: string;
  title: string;
  category: string;
  status: ProjectStatus;
  technologies: string[];
  description: string;
  github?: string;
  live?: string;
  contributors?: { username: string; role: string; status?: 'PENDING' | 'ACCEPTED' }[];
  featured?: boolean;
  private?: boolean;
  screenshots?: number;
  age: number;
}

const PROJECTS: SeedProject[] = [
  {
    owner: 'kwame_dev', title: 'CampusEats — Pre-order from Campus Canteens', category: 'Web Development', status: 'COMPLETED', age: 40, featured: true, screenshots: 2,
    technologies: ['React', 'Node.js', 'Express', 'PostgreSQL', 'Paystack'],
    description: 'CampusEats lets students browse canteen menus, pre-order meals and pay with mobile money so they can skip the lunchtime queue.\n\nVendors get a simple dashboard to manage menu items and mark orders as ready. Built during a 48-hour hackathon and now used by three canteens on campus.\n\nHighlights:\n- Real-time order status with Server-Sent Events\n- Mobile money payments through Paystack\n- Vendor analytics for best-selling items',
    github: 'https://github.com/example/campuseats', live: 'https://campuseats.example.com',
    contributors: [{ username: 'efua_designs', role: 'UI/UX Designer' }, { username: 'nana_akua', role: 'Product' }],
  },
  {
    owner: 'yawml', title: 'TwiSpeak: Speech Recognition for Twi', category: 'Artificial Intelligence', status: 'ONGOING', age: 25, featured: true,
    technologies: ['Python', 'PyTorch', 'Hugging Face', 'Whisper'],
    description: 'Fine-tuning Whisper on a crowd-sourced dataset of Twi speech to build an open speech-to-text model for one of Ghana\'s most spoken languages.\n\nWe collected 40 hours of audio from volunteers and achieved a 28% word error rate so far. The next milestone is a mobile keyboard that supports voice input.',
    github: 'https://github.com/example/twispeak',
    contributors: [{ username: 'abena_data', role: 'Data Pipeline' }],
  },
  {
    owner: 'ama_codes', title: 'Smart Hostel Energy Monitor', category: 'Internet of Things', status: 'COMPLETED', age: 60, screenshots: 1,
    technologies: ['ESP32', 'MQTT', 'InfluxDB', 'Grafana', 'C++'],
    description: 'Clip-on current sensors connected to ESP32 boards report each hostel room\'s electricity use every 30 seconds. A Grafana dashboard shows usage trends and sends alerts when appliances are left on.\n\nThe pilot in one hostel block reduced monthly consumption by 12%.',
    github: 'https://github.com/example/hostel-energy',
  },
  {
    owner: 'kofisec', title: 'PhishGuard Browser Extension', category: 'Cybersecurity', status: 'ONGOING', age: 18,
    technologies: ['JavaScript', 'Chrome Extensions', 'Python', 'scikit-learn'],
    description: 'A browser extension that flags suspicious links in webmail using a lightweight URL classifier trained on public phishing datasets. Runs fully on-device so no browsing data leaves the computer.\n\nCurrently detecting 94% of phishing URLs in our test set with a 2% false-positive rate.',
    github: 'https://github.com/example/phishguard',
  },
  {
    owner: 'abena_data', title: 'Accra Traffic Patterns Dashboard', category: 'Data Science', status: 'COMPLETED', age: 75, featured: true, screenshots: 2,
    technologies: ['Python', 'Pandas', 'Plotly', 'Streamlit'],
    description: 'An interactive dashboard analysing two years of ride-hailing trip times across Accra to find the worst congestion hotspots by time of day.\n\nIncludes a "best time to leave" estimator for common commuter routes.',
    live: 'https://accra-traffic.example.com',
  },
  {
    owner: 'zainab_mobile', title: 'MarketMate — Inventory for Market Traders', category: 'Mobile Development', status: 'COMPLETED', age: 33,
    technologies: ['Flutter', 'Dart', 'Firebase', 'SQLite'],
    description: 'An offline-first Flutter app that helps market traders track stock, record sales and see weekly profit, even without reliable internet. Data syncs to Firebase when a connection is available.\n\nDesigned with traders in Kano through three rounds of in-person testing.',
    github: 'https://github.com/example/marketmate',
    contributors: [{ username: 'efua_designs', role: 'UX Research' }],
  },
  {
    owner: 'chidi_builds', title: 'Autonomous Campus Delivery Rover', category: 'Robotics', status: 'ONGOING', age: 12, screenshots: 1,
    technologies: ['ROS', 'C++', 'OpenCV', 'Raspberry Pi'],
    description: 'A small six-wheeled rover that delivers parcels between the faculty office and the student hub. Uses visual odometry and GPS waypoints for navigation, with obstacle avoidance from a depth camera.\n\nPhase 1 (teleoperation) is done; we are now testing autonomous waypoint following.',
    github: 'https://github.com/example/campus-rover',
    contributors: [{ username: 'ama_codes', role: 'Embedded Systems' }],
  },
  {
    owner: 'efua_designs', title: 'Accessible Student Portal Redesign', category: 'UI/UX Design', status: 'COMPLETED', age: 50,
    technologies: ['Figma', 'Maze', 'WCAG'],
    description: 'A case study redesigning our university\'s course registration portal. Usability testing with 18 students, including screen-reader users, found 23 issues; the redesign cut average registration time from 14 to 5 minutes.\n\nIncludes the full design system and an interactive Figma prototype.',
    live: 'https://www.figma.com/community',
  },
  {
    owner: 'yawml', title: 'Crop Disease Detector', category: 'Machine Learning', status: 'COMPLETED', age: 90,
    technologies: ['TensorFlow', 'Python', 'TensorFlow Lite', 'Android'],
    description: 'A MobileNet-based classifier that identifies five common cassava and maize diseases from leaf photos, running offline on low-end Android phones.\n\nTrained on 12,000 labelled images with 91% validation accuracy.',
    github: 'https://github.com/example/crop-disease',
  },
  {
    owner: 'nana_akua', title: 'Susu Savings Tracker', category: 'Web Development', status: 'ONGOING', age: 8,
    technologies: ['Next.js', 'TypeScript', 'Prisma', 'PostgreSQL', 'Tailwind CSS'],
    description: 'A digital ledger for traditional susu savings groups. Collectors record daily contributions, members get SMS receipts, and payouts are scheduled automatically.\n\nWe are piloting it with two savings groups in Madina.',
    github: 'https://github.com/example/susu-tracker',
    contributors: [{ username: 'kwame_dev', role: 'Backend', status: 'PENDING' }],
  },
  {
    owner: 'dtetteh', title: 'Algorithm Visualiser', category: 'Web Development', status: 'COMPLETED', age: 120,
    technologies: ['TypeScript', 'React', 'D3.js'],
    description: 'Step through sorting, graph and dynamic-programming algorithms with animated visualisations and synchronised pseudocode. Built to help first-year students prepare for data structures exams.',
    github: 'https://github.com/example/algo-vis', live: 'https://algo-vis.example.com',
  },
  {
    owner: 'kofisec', title: 'Campus Wi-Fi Security Audit Toolkit', category: 'Cybersecurity', status: 'PLANNING', age: 3,
    technologies: ['Python', 'Scapy', 'Linux'],
    description: 'A planned toolkit (with permission from the IT directorate) to audit campus Wi-Fi configuration: detecting rogue access points, weak encryption settings and captive-portal weaknesses. Looking for collaborators interested in network security.',
  },
  {
    owner: 'ama_codes', title: 'Plant Watering System', category: 'Internet of Things', status: 'COMPLETED', age: 140,
    technologies: ['Arduino', 'C++', 'Blynk'],
    description: 'Soil-moisture sensors and a small pump keep the departmental garden watered automatically. Moisture readings and pump history are visible from a phone app.',
  },
  {
    owner: 'abena_data', title: 'Graduate Employment Survey Analysis', category: 'Data Science', status: 'ONGOING', age: 20,
    technologies: ['R', 'ggplot2', 'Quarto'],
    description: 'Analysing survey responses from 1,200 recent graduates to understand time-to-employment across programmes. The final report will be shared with the career services office.',
    private: true,
  },
  {
    owner: 'zainab_mobile', title: 'Study Buddy Matcher', category: 'Mobile Development', status: 'PLANNING', age: 2,
    technologies: ['Kotlin', 'Jetpack Compose', 'Firebase'],
    description: 'An Android app that matches students taking the same courses into study groups based on schedules and preferred study styles. Currently in the design phase.',
  },
  {
    owner: 'chidi_builds', title: 'Line-Following Robot Workshop Kit', category: 'Robotics', status: 'COMPLETED', age: 200,
    technologies: ['Arduino', 'C++', 'KiCad'],
    description: 'An open-hardware kit and lesson plan used to teach 60 first-year students the basics of sensors, motors and control loops. Includes PCB files, a bill of materials under $15, and step-by-step guides.',
    github: 'https://github.com/example/line-follower-kit',
  },
];

const COMMENTS = [
  'This is really impressive work! How long did it take you to build?',
  'Love the attention to detail in the UI.',
  'Is the source code available? I would love to contribute.',
  'Great idea. Have you thought about adding offline support?',
  'We had the same problem on our campus, this would be so useful.',
  'How did you handle authentication?',
  'The demo is super smooth. Nice job!',
  'What was the hardest part of the project?',
  'Would be great to see a write-up of your architecture.',
  'Congrats on shipping this!',
];

const REPLIES = [
  'Thanks! It took about six weeks, mostly evenings.',
  'Yes, the repo is linked above. PRs welcome!',
  'Good question, I wrote a short section about it in the README.',
  'Offline support is on the roadmap for next semester.',
  'Agreed, I would use this every day.',
  'Thank you, really appreciate it!',
];

function escapeXml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
}

function wrap(text: string, max: number) {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if ((line + ' ' + word).trim().length > max) {
      lines.push(line.trim());
      line = word;
    } else line += ` ${word}`;
  }
  if (line.trim()) lines.push(line.trim());
  return lines.slice(0, 3);
}

/** Generates a clean 16:9 cover: solid tone, dot grid, title and tech chips. */
function coverSvg(title: string, category: string, techs: string[], color: string) {
  const titleLines = wrap(title, 26)
    .map((l, i) => `<text x="96" y="${400 + i * 92}" font-size="76" font-weight="700" fill="#fff">${escapeXml(l)}</text>`)
    .join('');
  let x = 96;
  const chips = techs.slice(0, 4).map((t) => {
    const w = t.length * 17 + 48;
    const chip = `<rect x="${x}" y="720" width="${w}" height="56" rx="28" fill="rgba(255,255,255,0.14)"/><text x="${x + 24}" y="757" font-size="28" fill="#fff">${escapeXml(t)}</text>`;
    x += w + 16;
    return chip;
  }).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" font-family="Segoe UI, Helvetica, Arial, sans-serif">
  <defs><pattern id="dots" width="32" height="32" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="2" fill="rgba(255,255,255,0.10)"/></pattern></defs>
  <rect width="1600" height="900" fill="${color}"/>
  <rect width="1600" height="900" fill="url(#dots)"/>
  <circle cx="1380" cy="180" r="260" fill="rgba(255,255,255,0.06)"/>
  <text x="96" y="250" font-size="30" letter-spacing="4" fill="rgba(255,255,255,0.75)">${escapeXml(category.toUpperCase())}</text>
  ${titleLines}
  ${chips}
</svg>`);
}

/** A simple wireframe-style "screenshot" so galleries have content. */
function screenshotSvg(title: string, color: string, variant: number) {
  const cards = Array.from({ length: 6 }, (_, i) => {
    const cx = 380 + (i % 3) * 460;
    const cy = 260 + Math.floor(i / 3) * 360;
    return `<rect x="${cx}" y="${cy}" width="420" height="320" rx="16" fill="#fff" stroke="#e4e4e7"/>
      <rect x="${cx + 24}" y="${cy + 24}" width="372" height="160" rx="10" fill="${color}" opacity="${0.15 + ((i + variant) % 3) * 0.2}"/>
      <rect x="${cx + 24}" y="${cy + 208}" width="${200 + ((i * 37) % 140)}" height="20" rx="6" fill="#d4d4d8"/>
      <rect x="${cx + 24}" y="${cy + 244}" width="160" height="16" rx="6" fill="#e4e4e7"/>`;
  }).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" font-family="Segoe UI, Helvetica, Arial, sans-serif">
  <rect width="1920" height="1080" fill="#fafafa"/>
  <rect width="1920" height="88" fill="#fff" stroke="#e4e4e7"/>
  <circle cx="64" cy="44" r="18" fill="${color}"/>
  <text x="100" y="54" font-size="28" font-weight="600" fill="#18181b">${escapeXml(title)}</text>
  <rect x="0" y="88" width="320" height="992" fill="#fff" stroke="#e4e4e7"/>
  ${[0, 1, 2, 3, 4].map((i) => `<rect x="40" y="${140 + i * 64}" width="${180 + (i % 2) * 40}" height="20" rx="6" fill="${i === variant % 5 ? color : '#e4e4e7'}"/>`).join('')}
  <text x="380" y="200" font-size="40" font-weight="700" fill="#18181b">${variant % 2 ? 'Overview' : 'Dashboard'}</text>
  ${cards}
</svg>`);
}

async function main() {
  console.log('Clearing existing data…');
  await prisma.$transaction([
    prisma.report.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.like.deleteMany(),
    prisma.projectContributor.deleteMany(),
    prisma.projectImage.deleteMany(),
    prisma.projectTechnology.deleteMany(),
    prisma.project.deleteMany(),
    prisma.technology.deleteMany(),
    prisma.category.deleteMany(),
    prisma.authToken.deleteMany(),
    prisma.userSession.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  console.log('Creating categories…');
  const categories = new Map<string, string>();
  for (const [name, description] of CATEGORIES) {
    const c = await prisma.category.create({ data: { name, slug: slugify(name), description } });
    categories.set(name, c.id);
  }

  console.log('Creating users…');
  const studentHash = await argon2.hash('Password123', { type: argon2.argon2id });
  const adminHash = await argon2.hash('Admin12345', { type: argon2.argon2id });

  await prisma.user.create({
    data: {
      fullName: 'Platform Admin',
      username: 'admin',
      email: 'admin@studenthub.dev',
      passwordHash: adminHash,
      university: 'Student Project Hub',
      department: 'Administration',
      role: 'ADMIN',
      emailVerifiedAt: new Date(),
      lastActiveAt: new Date(),
    },
  });

  const users = new Map<string, string>();
  for (const [i, u] of USERS.entries()) {
    const created = await prisma.user.create({
      data: {
        ...u,
        email: `${u.username}@students.example.edu`,
        passwordHash: studentHash,
        githubUrl: `https://github.com/${u.username}`,
        linkedinUrl: i % 2 === 0 ? `https://www.linkedin.com/in/${u.username}` : null,
        emailVerifiedAt: daysAgo(200),
        createdAt: daysAgo(210 - i * 10),
        lastActiveAt: daysAgo(i * 0.6),
      },
    });
    users.set(u.username, created.id);
  }
  const userIds = [...users.values()];

  console.log('Creating projects and images (this takes a few seconds)…');
  const technologies = new Map<string, string>();
  const projectIds: { id: string; ownerId: string; title: string; isPublic: boolean }[] = [];

  for (const [i, p] of PROJECTS.entries()) {
    const color = PALETTE[i % PALETTE.length]!;
    const cover = await storeImageBuffer(coverSvg(p.title, p.category, p.technologies, color), 'projects/covers', 'cover');
    const screenshots = [];
    for (let s = 0; s < (p.screenshots ?? 0); s++) {
      screenshots.push(await storeImageBuffer(screenshotSvg(p.title, color, s + i), 'projects/screenshots', 'screenshot'));
    }

    const techIds: string[] = [];
    for (const name of p.technologies) {
      const slug = slugify(name);
      if (!technologies.has(slug)) {
        const t = await prisma.technology.create({ data: { name, slug } });
        technologies.set(slug, t.id);
      }
      techIds.push(technologies.get(slug)!);
    }

    const ownerId = users.get(p.owner)!;
    const createdAt = daysAgo(p.age);
    const project = await prisma.project.create({
      data: {
        title: p.title,
        description: p.description,
        status: p.status,
        visibility: p.private ? 'PRIVATE' : 'PUBLIC',
        githubUrl: p.github,
        liveUrl: p.live,
        coverImageUrl: cover.url,
        coverImagePath: cover.path,
        isFeatured: Boolean(p.featured),
        featuredAt: p.featured ? daysAgo(1) : null,
        ownerId,
        categoryId: categories.get(p.category)!,
        createdAt,
        technologies: { create: techIds.map((technologyId) => ({ technologyId })) },
        images: { create: screenshots.map((s, position) => ({ url: s.url, path: s.path, position })) },
        contributors: {
          create: (p.contributors ?? []).map((c) => ({
            userId: users.get(c.username)!,
            role: c.role,
            status: c.status ?? 'ACCEPTED',
            invitedById: ownerId,
            respondedAt: c.status === 'PENDING' ? null : createdAt,
          })),
        },
      },
    });
    projectIds.push({ id: project.id, ownerId, title: project.title, isPublic: !p.private });

    for (const c of p.contributors ?? []) {
      if (c.status === 'PENDING') {
        await prisma.notification.create({
          data: {
            type: 'CONTRIBUTOR_INVITED',
            recipientId: users.get(c.username)!,
            actorId: ownerId,
            projectId: project.id,
            message: `invited you to contribute to "${project.title}"`,
          },
        });
      }
    }
  }

  console.log('Creating likes, comments and notifications…');
  for (const project of projectIds.filter((p) => p.isPublic)) {
    const likers = sample(userIds.filter((id) => id !== project.ownerId), 1 + Math.floor(rand() * 8));
    for (const userId of likers) {
      await prisma.like.create({ data: { userId, projectId: project.id, createdAt: daysAgo(rand() * 10) } });
    }
    await prisma.notification.createMany({
      data: likers.slice(0, 3).map((actorId) => ({
        type: 'PROJECT_LIKED' as const,
        recipientId: project.ownerId,
        actorId,
        projectId: project.id,
        message: `liked your project "${project.title}"`,
        readAt: rand() > 0.5 ? new Date() : null,
      })),
    });

    let commentCount = 0;
    const commenters = sample(userIds.filter((id) => id !== project.ownerId), Math.floor(rand() * 4));
    for (const authorId of commenters) {
      const root = await prisma.comment.create({
        data: { content: pick(COMMENTS), projectId: project.id, authorId, createdAt: daysAgo(rand() * 6 + 1) },
      });
      commentCount++;
      await prisma.notification.create({
        data: {
          type: 'PROJECT_COMMENTED',
          recipientId: project.ownerId,
          actorId: authorId,
          projectId: project.id,
          commentId: root.id,
          message: `commented on your project "${project.title}"`,
        },
      });
      if (rand() > 0.4) {
        const reply = await prisma.comment.create({
          data: {
            content: pick(REPLIES),
            projectId: project.id,
            authorId: project.ownerId,
            parentId: root.id,
            rootId: root.id,
            createdAt: new Date(root.createdAt.getTime() + 3_600_000),
          },
        });
        commentCount++;
        await prisma.notification.create({
          data: {
            type: 'COMMENT_REPLIED',
            recipientId: authorId,
            actorId: project.ownerId,
            projectId: project.id,
            commentId: reply.id,
            message: `replied to your comment on "${project.title}"`,
          },
        });
      }
    }

    await prisma.project.update({
      where: { id: project.id },
      data: { likeCount: likers.length, commentCount },
    });
  }

  const reporter = users.get('dtetteh')!;
  const reported = projectIds.find((p) => p.isPublic && p.ownerId !== reporter)!;
  await prisma.report.create({
    data: {
      reporterId: reporter,
      targetType: 'PROJECT',
      projectId: reported.id,
      reason: 'MISLEADING',
      details: 'The live demo link does not seem to match the project description.',
    },
  });

  console.log(
    `Seeded ${USERS.length + 1} users, ${CATEGORIES.length} categories, ${technologies.size} technologies, ${PROJECTS.length} projects.`,
  );
  console.log('Admin login: admin@studenthub.dev / Admin12345');
  console.log('Student login: kwame_dev@students.example.edu / Password123');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
