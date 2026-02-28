import LegalPageLayout from '@/components/legal/LegalPageLayout'
import { LEGAL_EFFECTIVE_DATE_LABEL } from '@/src/lib/legalVersions'

export default function CookiesPage() {
  return (
    <LegalPageLayout
      title="Cookie Notice"
      subtitle="This notice explains the cookies and local storage choices used to run Internactive."
      versionLabel={LEGAL_EFFECTIVE_DATE_LABEL}
    >
      <section>
        <h2 className="text-lg font-semibold text-slate-900">How Internactive Uses Cookies and Local Storage</h2>
        <div className="mt-3 space-y-3">
          <p>
            Internactive uses a limited set of cookies and local storage values to keep the site working, remember basic
            preferences, and understand service usage. This is an operational notice, not a full consent manager.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Authentication and Session Data</h2>
        <div className="mt-3 space-y-3">
          <p>
            We use authentication and session cookies provided through our infrastructure to sign users in, keep sessions
            active, protect accounts, and support core account features. Without these cookies, login and account-related
            pages may not function correctly.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Preferences and Product State</h2>
        <div className="mt-3 space-y-3">
          <p>
            We use local storage for lightweight product preferences and interface state. Examples include dismissing the
            cookie notice, storing onboarding progress, and preserving some draft or return-flow behavior between visits.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Analytics and Security Signals</h2>
        <div className="mt-3 space-y-3">
          <p>
            We record usage and security events to understand how the service is used, diagnose problems, rate-limit
            abusive traffic, and improve the platform. Those events may rely on request metadata such as IP address,
            browser details, and interaction history, even when they are not stored as browser cookies.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Managing Cookies</h2>
        <div className="mt-3 space-y-3">
          <p>
            Most browsers let you clear cookies, block cookies, or notify you before cookies are stored. You can also
            clear local storage through your browser settings. If you block essential cookies or storage used for account
            state, some parts of Internactive may stop working as expected.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Related Information</h2>
        <div className="mt-3 space-y-3">
          <p>
            For more detail about how we collect, use, and share personal information, please review our{' '}
            <a className="font-medium text-blue-700 hover:underline" href="/privacy">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </section>
    </LegalPageLayout>
  )
}
