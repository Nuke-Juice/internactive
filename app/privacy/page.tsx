import LegalPageLayout from '@/components/legal/LegalPageLayout'
import { LEGAL_CONTACT_EMAIL, LEGAL_EFFECTIVE_DATE_LABEL } from '@/src/lib/legalVersions'

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      subtitle="This policy explains what Internactive collects, how we use it, and the choices available to people using the platform."
      versionLabel={LEGAL_EFFECTIVE_DATE_LABEL}
    >
      <section>
        <h2 className="text-lg font-semibold text-slate-900">Who We Are</h2>
        <p className="mt-3">
          Internactive LLC is a Utah-based internship marketplace. We help students discover opportunities, maintain
          profiles, submit applications, and communicate with employers. If you have questions about this policy or our
          privacy practices, contact us at{' '}
          <a className="font-medium text-blue-700 hover:underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">What We Collect</h2>
        <div className="mt-3 space-y-3">
          <p>
            We collect information you provide directly when you create an account, build a profile, post internships,
            apply to opportunities, message through the platform, or contact us.
          </p>
          <p>
            Account and identity data may include your name, email address, password or authentication credentials, and
            role selection such as student or employer.
          </p>
          <p>
            Student profile data may include school, majors, graduation year or class standing, coursework, skills,
            desired roles, availability, preferred work mode, preferred location, and other information you choose to
            add to improve matching and application quality.
          </p>
          <p>
            Employer data may include company name, website, industry, company size, internship types, founded year,
            company description, employer contact email, and business address or location details.
          </p>
          <p>
            User content may include resumes or CVs, application notes, messages, and optional uploaded images such as
            profile photos, logos, or header images.
          </p>
          <p>
            Location-related data may include city, state, ZIP code, business address, and exact address information
            when you choose to provide it. We use this information to support location-based matching, commute-related
            features, and employer profile display.
          </p>
          <p>
            We also collect derivative and technical data such as IP address, browser or device information, request
            logs, security signals, and analytics events that show how people use the product.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">How We Use Information</h2>
        <div className="mt-3 space-y-3">
          <p>
            We use personal information to operate the marketplace, create and maintain accounts, support student and
            employer profiles, rank and match internships, process applications, and provide messaging, notifications,
            and account management tools.
          </p>
          <p>
            We use information to improve the service, measure product usage, troubleshoot issues, prevent abuse, enforce
            our terms, and maintain platform security.
          </p>
          <p>
            We may also use account and contact information to send administrative communications such as verification
            emails, password resets, billing notices, support responses, and important policy or product updates.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">How We Share Information</h2>
        <div className="mt-3 space-y-3">
          <p>
            Information becomes visible to other users when that visibility is part of the service. For example, when a
            student applies for an internship, the employer may receive profile details, application materials, match
            information, and resume access needed to evaluate the candidate.
          </p>
          <p>
            We share information with service providers that help us operate the platform, such as Supabase for database
            and authentication infrastructure, Stripe for payment processing, and hosting or delivery vendors that keep
            the product available and secure.
          </p>
          <p>
            We may disclose information if we reasonably believe it is necessary to comply with law, protect users,
            enforce our agreements, or respond to lawful requests from courts, regulators, or law enforcement.
          </p>
          <p>We do not sell personal information for money.</p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Data Retention</h2>
        <div className="mt-3 space-y-3">
          <p>
            We generally keep personal information while your account is active and for as long as needed to operate the
            marketplace, keep records of applications and subscriptions, maintain security, and resolve disputes or legal
            obligations.
          </p>
          <p>
            You can update your account and profile information in settings. To request deletion of your account or
            personal information, contact{' '}
            <a className="font-medium text-blue-700 hover:underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
              {LEGAL_CONTACT_EMAIL}
            </a>
            . Some information may be retained for limited legal, fraud-prevention, billing, backup, or operational
            reasons.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Your Choices and Rights</h2>
        <div className="mt-3 space-y-3">
          <p>
            You can review and update much of your account and profile information in account settings. Students and
            employers can also change the information used for matching, applications, and public profile presentation.
          </p>
          <p>
            If you need help accessing, correcting, or deleting your data, email{' '}
            <a className="font-medium text-blue-700 hover:underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
              {LEGAL_CONTACT_EMAIL}
            </a>
            . We will review requests in light of applicable law and the operational needs of the service.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Security</h2>
        <div className="mt-3 space-y-3">
          <p>
            We use reasonable administrative, technical, and organizational safeguards designed to protect personal
            information and support the security of the platform.
          </p>
          <p>
            No method of transmission over the internet or electronic storage is completely secure, and we cannot
            guarantee absolute security.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Third-Party Services and Links</h2>
        <div className="mt-3 space-y-3">
          <p>
            Internactive may include links to employer websites, applicant tracking systems, payment processors, or
            other third-party services. When you leave our platform or interact with an external service, that third
            party’s terms and privacy practices apply.
          </p>
          <p>
            We are not responsible for the privacy, security, availability, or content practices of third-party sites or
            services.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">U.S. Focus</h2>
        <div className="mt-3 space-y-3">
          <p>
            Internactive is currently intended for users in the United States. We operate the service with a U.S.-focused
            product and legal framework.
          </p>
          <p>
            We do not make jurisdiction-specific commitments for GDPR or other international privacy regimes at this
            time. If our geographic scope changes, we may update this policy accordingly.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Children</h2>
        <p className="mt-3">
          Internactive is not directed to children under 13, and we do not intend for children under 13 to use the
          platform.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Changes to This Policy</h2>
        <div className="mt-3 space-y-3">
          <p>
            We may update this policy from time to time. When we do, we will revise the last updated date on this page
            and may provide additional notice if the changes are material.
          </p>
          <p>This Privacy Policy is effective as of {LEGAL_EFFECTIVE_DATE_LABEL}.</p>
        </div>
      </section>
    </LegalPageLayout>
  )
}
