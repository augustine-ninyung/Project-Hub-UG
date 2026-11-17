import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/common/section';

const UPDATED = '17 November 2026';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-20 space-y-3">
      <h2 id={`${id}-h`} className="font-display text-xl font-medium tracking-tight">
        {title}
      </h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-foreground/90 [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}

const SECTIONS = [
  ['collect', 'What we keep'],
  ['visible', 'What others can see'],
  ['use', 'How we use it'],
  ['services', 'Services we rely on'],
  ['cookies', 'Cookies and your browser'],
  ['retention', 'How long we keep it'],
  ['choices', 'Your choices'],
  ['contact', 'Questions'],
] as const;

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl pb-12">
      <PageHeader title="Privacy" description={`How ProjectHub handles your information. Last updated ${UPDATED}.`} />

      <div className="mb-8 rounded-xl border bg-muted/40 p-5 text-[15px] leading-relaxed">
        <p className="mb-2 font-medium">In short</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>We keep what you give us to run your account and show your projects, and nothing more.</li>
          <li>Your profile and public projects are visible to everyone. Your email address and password are not.</li>
          <li>No ads, no tracking, no analytics, and we never sell or share your information for marketing.</li>
          <li>You can delete your account from Settings at any time.</li>
        </ul>
      </div>

      <nav aria-label="On this page" className="mb-10">
        <ol className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {SECTIONS.map(([id, title]) => (
            <li key={id}>
              <a href={`#${id}`} className="hover:text-foreground hover:underline">
                {title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="space-y-10">
        <Section id="collect" title="What we keep">
          <p>When you create an account and use ProjectHub, we store:</p>
          <ul>
            <li>
              <strong>Account details:</strong> your name, username, email address, university and department. Your
              password is stored only in a scrambled form (hashed) that nobody, including us, can read back.
            </li>
            <li>
              <strong>Profile:</strong> anything you add, such as a photo, bio, skills and links to GitHub, LinkedIn or a
              portfolio.
            </li>
            <li>
              <strong>What you share:</strong> your projects with their images, your comments and replies, likes,
              reports you send, and the teammates you invite.
            </li>
            <li>
              <strong>Account activity:</strong> when you signed up, confirmed your email, were approved, and were last
              active, plus your notifications.
            </li>
            <li>
              <strong>Sign-in records:</strong> for each device you sign in on, the browser type and internet (IP)
              address, so sessions can be kept secure and ended.
            </li>
          </ul>
          <p>
            Our server also keeps short-lived counters of attempts per internet address and per account, to stop people
            guessing passwords or flooding the site, and our host keeps standard technical logs for a short time.
          </p>
        </Section>

        <Section id="visible" title="What others can see">
          <ul>
            <li>
              <strong>Everyone, even without an account:</strong> your profile (name, username, photo, university,
              department, bio, skills and links), your public projects, and your comments. You may appear in the list of
              recently active students.
            </li>
            <li>
              <strong>Only people you add:</strong> private projects are shown only to you, the teammates you invite,
              and admins. Images are stored at long, hard-to-guess web addresses; anyone who is given an image's address
              can open it.
            </li>
            <li>
              <strong>Admins only:</strong> your email address, sign-up and activity dates, and anything needed to
              review reports or account requests.
            </li>
            <li>
              <strong>Nobody:</strong> your password.
            </li>
          </ul>
        </Section>

        <Section id="use" title="How we use it">
          <ul>
            <li>To run your account, show your projects and connect you with other students.</li>
            <li>
              To send emails you need: confirming your address, account approval, and password resets. We don't send
              newsletters or marketing.
            </li>
            <li>To keep the community safe: approving new accounts, reviewing reports and stopping abuse.</li>
            <li>To keep the site working: fixing errors and keeping daily backups.</li>
          </ul>
        </Section>

        <Section id="services" title="Services we rely on">
          <p>ProjectHub runs on a few outside services, which handle your information only to provide them:</p>
          <ul>
            <li>
              <strong>Vercel</strong> hosts the website and its server.
            </li>
            <li>
              <strong>Supabase</strong> stores the database, uploaded images, the daily backups, and powers live
              updates. Its servers are in the European Union (Ireland).
            </li>
            <li>
              <strong>Google</strong> sends our emails through Gmail, and provides the website's fonts, which means your
              browser contacts Google to load them.
            </li>
          </ul>
        </Section>

        <Section id="cookies" title="Cookies and your browser">
          <p>
            We use two cookies, only to keep you signed in. They can't be read by the page's scripts and aren't used for
            tracking. Your browser also remembers your light or dark theme and whether the sidebar is collapsed. There
            are no advertising or analytics cookies.
          </p>
        </Section>

        <Section id="retention" title="How long we keep it">
          <ul>
            <li>Your account and content: until you or an admin delete them.</li>
            <li>
              Sign-ins: up to 30 days on each device, unless you sign out sooner. Confirmation and password-reset links
              stop working after 24 hours and 1 hour.
            </li>
            <li>
              Backups: a copy of the database is saved every day and each copy is deleted after 30 days. So after your
              account is deleted, your information can remain in backups for up to 30 days; they are private and only
              used to recover from a disaster.
            </li>
          </ul>
        </Section>

        <Section id="choices" title="Your choices">
          <ul>
            <li>
              <strong>See and change your details</strong> at any time in <Link to="/settings" className="text-primary hover:underline">Settings</Link>{' '}
              and on your profile.
            </li>
            <li>
              <strong>Remove what you shared:</strong> delete your projects and comments whenever you like, or make a
              project private.
            </li>
            <li>
              <strong>Delete your account:</strong> in Settings, choose <em>Delete account</em>. You are signed out and
              hidden straight away, and an admin then deletes your account, projects, comments, likes and images for
              good.
            </li>
          </ul>
        </Section>

        <Section id="contact" title="Questions">
          <p>
            If you have a question about your information or want something corrected or removed, reply to any email
            you've received from ProjectHub and an admin will get back to you. If this page changes, we'll update the
            date at the top.
          </p>
        </Section>
      </div>
    </div>
  );
}
