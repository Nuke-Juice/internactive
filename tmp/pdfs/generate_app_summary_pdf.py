from pathlib import Path

OUT = Path('output/pdf/internactive-app-summary.pdf')
PAGE_W, PAGE_H = 612, 792
LEFT = 48
TOP = 752
BOTTOM = 48

lines = [
    ("title", "Internactive App Summary"),
    ("blank", ""),
    ("h", "What it is"),
    ("p", "Internactive is a browse-first internship marketplace built with Next.js and Supabase."),
    ("p", "Students discover and apply to internships, while employers publish roles and manage applicants."),
    ("blank", ""),
    ("h", "Who it is for"),
    ("p", "Primary users: college students seeking internships and employers hiring interns."),
    ("blank", ""),
    ("h", "What it does"),
    ("b", "Public internship feed with filters (category, pay, remote, experience, hours, location/radius)."),
    ("b", "Student onboarding captures profile signals (majors, coursework, preferences) for better ranking."),
    ("b", "Match scoring and ranking using canonical skills/coursework plus eligibility constraints."),
    ("b", "Employer dashboard for posting internships and reviewing applicants with inbox controls."),
    ("b", "Apply flows support native apply and external ATS links, with analytics event tracking."),
    ("b", "Admin tools include internships/employers/students views and matching preview/report routes."),
    ("b", "Stripe billing webhooks update employer verification and student premium subscription status."),
    ("blank", ""),
    ("h", "How it works (repo-evidenced architecture)"),
    ("b", "Frontend: Next.js App Router pages in /app plus shared UI/components."),
    ("b", "App services: server-side route handlers in /app/api for analytics, auth, resume, coursework, billing."),
    ("b", "Data + auth: Supabase SSR client for user/session queries; service-role client for admin/webhook writes."),
    ("b", "Matching engine: lib/matching.ts; JobsView fetches internships, builds profile signals, then ranks."),
    ("b", "Billing flow: Stripe -> /api/stripe/webhook -> Supabase tables (processed_stripe_events, subscriptions, profiles)."),
    ("b", "Protected admin flow: middleware role-checks users.role and gates /admin routes."),
    ("blank", ""),
    ("h", "How to run (minimal)"),
    ("n", "1. Use Node 22.11.0 and npm >=10 (see .nvmrc and package.json engines)."),
    ("n", "2. Install deps: npm ci"),
    ("n", "3. Create env file: copy .env.example to .env.local and fill Supabase/Stripe values."),
    ("n", "4. Start app: npm run dev, then open http://localhost:3000"),
    ("n", "5. Optional verification: npm test"),
    ("n", "6. Local DB bootstrap/seed workflow: Not found in repo."),
]

style = {
    "title": {"font": "F2", "size": 18, "indent": 0, "leading": 24},
    "h": {"font": "F2", "size": 12, "indent": 0, "leading": 17},
    "p": {"font": "F1", "size": 10.5, "indent": 0, "leading": 14},
    "b": {"font": "F1", "size": 10.2, "indent": 0, "leading": 13},
    "n": {"font": "F1", "size": 10.2, "indent": 0, "leading": 13},
    "blank": {"font": "F1", "size": 10, "indent": 0, "leading": 8},
}

def esc(text: str) -> str:
    return text.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')

ops = []
# Paint solid white page background; then switch to black text.
ops.append(f"1 1 1 rg 0 0 {PAGE_W} {PAGE_H} re f")
ops.append("0 0 0 rg")

y = TOP
for kind, text in lines:
    cfg = style[kind]
    if kind != "blank":
        x = LEFT + cfg["indent"]
        label = f"- {text}" if kind == "b" else text
        ops.append(f"BT /{cfg['font']} {cfg['size']} Tf {x} {y} Td ({esc(label)}) Tj ET")
    y -= cfg["leading"]

if y < BOTTOM:
    raise SystemExit(f"Content overflow: y={y} is below bottom margin {BOTTOM}")

content = "\n".join(ops).encode("latin-1", errors="replace")

objs = []
objs.append("<< /Type /Catalog /Pages 2 0 R >>".encode())
objs.append("<< /Type /Pages /Kids [3 0 R] /Count 1 >>".encode())
objs.append(
    (
        "<< /Type /Page /Parent 2 0 R "
        "/MediaBox [0 0 612 792] "
        "/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> "
        "/Contents 6 0 R >>"
    ).encode()
)
objs.append("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".encode())
objs.append("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>".encode())
objs.append(f"<< /Length {len(content)} >>\nstream\n".encode() + content + b"\nendstream")

pdf = bytearray(b"%PDF-1.4\n")
offsets = [0]
for i, obj in enumerate(objs, start=1):
    offsets.append(len(pdf))
    pdf += f"{i} 0 obj\n".encode()
    pdf += obj
    pdf += b"\nendobj\n"

xref_pos = len(pdf)
pdf += f"xref\n0 {len(objs)+1}\n".encode()
pdf += b"0000000000 65535 f \n"
for off in offsets[1:]:
    pdf += f"{off:010d} 00000 n \n".encode()
pdf += f"trailer\n<< /Size {len(objs)+1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode()

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_bytes(pdf)
print(str(OUT.resolve()))
