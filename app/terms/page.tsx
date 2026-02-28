import LegalPageLayout from '@/components/legal/LegalPageLayout'
import { LEGAL_CONTACT_EMAIL, LEGAL_EFFECTIVE_DATE_LABEL } from '@/src/lib/legalVersions'

export default function TermsPage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      subtitle="These terms govern access to Internactive and the responsibilities of students, employers, and anyone else using the platform."
      versionLabel={LEGAL_EFFECTIVE_DATE_LABEL}
    >
      <section>
        <h2 className="text-lg font-semibold text-slate-900">Agreement to These Terms</h2>
        <p className="mt-3">
          By accessing or using Internactive, you agree to these Terms of Service. If you do not agree, do not use the
          platform.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Marketplace Only</h2>
        <div className="mt-3 space-y-3">
          <p>
            Internactive operates an online marketplace that helps students and employers find each other. We are not
            the employer, recruiter, staffing agency, school, or hiring decision-maker for internships posted through the
            service.
          </p>
          <p>
            We do not guarantee that any student will receive an internship, interview, offer, or response, and we do
            not guarantee that employers will receive qualified applicants.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Eligibility and Accounts</h2>
        <div className="mt-3 space-y-3">
          <p>
            You must provide accurate information, keep your login credentials secure, and use your account only for its
            intended purpose. You are responsible for activity that occurs under your account.
          </p>
          <p>
            You may not create accounts using false identities, impersonate another person or organization, or attempt to
            gain unauthorized access to other users, data, or systems.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Acceptable Use</h2>
        <div className="mt-3 space-y-3">
          <p>
            You may not use Internactive to violate law, interfere with the service, scrape the platform at scale,
            distribute malware, spam users, or submit content that is deceptive, abusive, discriminatory, infringing, or
            harmful.
          </p>
          <p>
            We may remove content, suspend listings, restrict access, or terminate accounts when we believe conduct puts
            users, the platform, or third parties at risk.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Employer Responsibilities</h2>
        <div className="mt-3 space-y-3">
          <p>
            Employers are responsible for the accuracy of listings, the legality of internships they post, and their own
            compliance with employment, wage-and-hour, privacy, anti-discrimination, and accessibility requirements.
          </p>
          <p>
            Employers must not post misleading opportunities, request information they are not legally entitled to
            collect, or use the platform to engage in discriminatory or retaliatory conduct.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Student Responsibilities</h2>
        <div className="mt-3 space-y-3">
          <p>
            Students are responsible for ensuring that their profiles, resumes, applications, and messages are truthful
            and not misleading. You may not impersonate another person, submit applications on behalf of another person
            without authorization, or upload content you do not have the right to use.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Applications and Hiring Decisions</h2>
        <div className="mt-3 space-y-3">
          <p>
            Employers decide whether to review, interview, or hire applicants. Internactive is not a party to employment
            discussions, hiring decisions, compensation agreements, background checks, onboarding, or the internship
            relationship itself.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Paid Plans and Payments</h2>
        <div className="mt-3 space-y-3">
          <p>
            Paid plans may be offered for some employer or student features. If you purchase a paid plan, payment will
            be processed by Stripe or another payment processor we designate at checkout. Additional terms presented at
            the time of purchase will apply.
          </p>
          <p>
            We do not state final pricing in these Terms. Pricing, billing intervals, included features, renewal rules,
            and cancellation terms may change and will be shown at the point of purchase.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Intellectual Property and User Content</h2>
        <div className="mt-3 space-y-3">
          <p>
            Internactive and its software, design, content, and branding are owned by Internactive LLC or its licensors.
            Except for the limited rights granted to use the service, these Terms do not transfer ownership of our
            intellectual property to you.
          </p>
          <p>
            You keep ownership of content you submit, such as resumes, messages, company descriptions, and listings. You
            grant us a non-exclusive license to host, store, process, reproduce, and display that content as needed to
            operate, secure, and improve the marketplace.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Termination</h2>
        <div className="mt-3 space-y-3">
          <p>
            You may stop using the service at any time. We may suspend or terminate accounts, remove listings, or limit
            access if we believe these Terms have been violated, the platform is being misused, or continued access would
            create legal, security, or operational risk.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Disclaimers</h2>
        <div className="mt-3 space-y-3">
          <p>
            Internactive is provided on an &quot;as is&quot; and &quot;as available&quot; basis. To the fullest extent permitted by law, we
            disclaim warranties of merchantability, fitness for a particular purpose, non-infringement, availability, and
            accuracy of listings, profiles, or outcomes.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Limitation of Liability</h2>
        <div className="mt-3 space-y-3">
          <p>
            To the fullest extent permitted by law, Internactive LLC and its affiliates will not be liable for indirect,
            incidental, consequential, special, exemplary, or punitive damages, or for lost profits, lost data, lost
            opportunities, or business interruption arising from or related to the service.
          </p>
          <p>
            If you paid fees to us in the 12 months before a claim arises, our total liability for that claim will not
            exceed the amount you paid during that period. If you did not pay any fees, our total liability will be
            limited to one hundred U.S. dollars.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Governing Law and Venue</h2>
        <div className="mt-3 space-y-3">
          <p>
            These Terms are governed by the laws of the State of Utah, without regard to conflict-of-law rules. Any
            dispute arising out of or relating to these Terms or the service must be brought in the state or federal
            courts located in Utah, and you consent to that jurisdiction and venue.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Changes and Contact</h2>
        <div className="mt-3 space-y-3">
          <p>
            We may revise these Terms from time to time. When we do, we will update the last updated date above.
            Continued use of the service after revised Terms take effect means you accept the updated Terms.
          </p>
          <p>
            Questions about these Terms can be sent to{' '}
            <a className="font-medium text-blue-700 hover:underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
              {LEGAL_CONTACT_EMAIL}
            </a>
            . These Terms are effective as of {LEGAL_EFFECTIVE_DATE_LABEL}.
          </p>
        </div>
      </section>
    </LegalPageLayout>
  )
}
