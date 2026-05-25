# Waterfall Money Pod — Product Brief
_Last updated: 2026-05-11_

---

### **1. WHAT IS IT?**
A personal money management pod that takes your income and runs it through a fixed, priority-ordered system — telling you exactly what to pay, set aside, and do with every dollar, every time you get paid.

---

### **2. WHAT PROBLEM DOES IT SOLVE?**
People with executive dysfunction, burnout, or neurodivergent brains don't struggle with money because they don't care — they struggle because the cognitive load of financial decision-making under chronic stress is genuinely impossible. The Waterfall eliminates that load entirely: it runs the math, makes the call, and hands you the verdict — and is honest when the month is broken instead of pretending everything is fine.

---

### **3. WHO WILL USE IT?**
Neurodivergent adults (ADHD, autistic, or both) managing real financial pressure alone — no financial partner, no support system, operating on variable or irregular income, carrying debt, and running on limited cognitive bandwidth. The system has to make the decisions for them, not hand the complexity back to them. Not for people with accountants, financial partners, or stable predictable income who just want better data.

---

### **4. WHAT DOES IT DO?**

1. Runs income through a fixed 6-bucket priority order: Must-Pay Bills → Future Bills → Cushion → Living Money → Debt Attack → Leftovers
2. Funds upcoming irregular expenses (car registration, vet bills, holidays) by saving only what's still missing — not the full amount over and over
3. Builds your emergency fund using a stair-step system — saves aggressively when it's low, backs off as it fills up
4. Switches to Survival Mode when money is tight — a different decision state, not just "save less"
5. Attacks debt using the Avalanche method (highest interest rate first) with automatic spillover when a debt is paid off
6. Lets you intentionally pull from your emergency fund when income is short — requires your explicit approval, never silently drains it
7. Declares a Hard Stop / Impossible Month when the numbers genuinely can't work — no fake reassurance
8. Outputs a short, plain-language, shame-free action list — no jargon, no judgment, no wall of numbers
9. [TBD] Visual money display — carry-forward from old design, not yet confirmed for the new Waterfall pod. Decision pending.
10. Stores all financial data locally, encrypted, behind a user-defined PIN

---

### **5. WHAT DOES IT NOT DO?**

- Does not connect to your bank or pull in transactions automatically
- Does not do taxes, investments, net worth tracking, or financial forecasting
- Does not give financial advice — output is a plan based on your numbers, not a guarantee

---

### **6. ANY SENSITIVE DATA?**

- [x] Passwords or login (PIN to unlock the money area)
- [ ] Payments or credit cards
- [x] Personal info (name, email, address, phone)
- [ ] Health or medical data
- [ ] None

**Note:** Personal info is checked because the app holds income amounts, bill details, and debt balances — that is personal financial data even if it doesn't include a name or email address. It is treated as sensitive: encrypted at rest, PIN-locked, with a hidden Audit Vault for full detail.

---

### **7. WHERE DOES IT RUN?**

- [x] Website (browser) — PWA, phone-first. Built to be used daily on a mobile screen, not at a desktop.
- [ ] Mobile app
- [ ] Desktop app
- [ ] Command line / no visual interface
- [ ] I don't know yet

---

### **8. ANY TECHNOLOGY PREFERENCES?**

JavaScript (money-engine.js + money-pod.js + money-pod.css). SQLCipher for local encrypted storage. PBKDF2 for PIN-derived encryption key. Integer cents or decimal math — no floating-point money math ever. Pod architecture: self-contained, mounts into `#tab-money`, plugs into Mission Control hub and can interact with other pods.

---

### **9. HOW WILL YOU KNOW IT WORKS?**

1. Enter a paycheck amount — verify all 6 buckets add up to exactly that amount with nothing left over or missing
2. Enter income that doesn't cover Must-Pay Bills — confirm Survival Mode triggers and Hard Stop displays correctly instead of a normal output
3. Set a Future Bill fund with money already saved — confirm it only saves the remaining gap, not the full target amount recalculated from scratch
4. Show the output to someone in a low-energy or overwhelmed state — they should understand what to do in under 10 seconds without reading or interpreting anything

---

### **10. ANYTHING ELSE?**

The design goal is to eliminate financial decisions entirely, not help the user make better ones. This is built for someone who is burned out, neurodivergent, and doing it alone — the output has to be a verdict, not a dashboard. Shame-free language is a confirmed design requirement, not a tone preference. Privacy is a design principle, not a feature — money data is encrypted by default, not as an add-on. This pod is also the first real test of the Mission Control pod architecture, so how it's built sets the pattern for every tab that comes after it. Eventually the proven patterns from this pod will feed into Space Station's redesign.

---

## **BEFORE YOU SEND, CHECK:**

- [x] I can describe it in one sentence
- [x] I listed specific features, not vague ideas
- [x] I said what it does NOT do
- [x] I identified any sensitive data
- [x] I know who the users are
- [x] I defined how I will know it works

---

## **OPEN FLAGS (from verify 2026-05-11)**

- **Feature 9 (depleting bar):** came from old money tab UI discussion, not confirmed in current WATERFALL-SCHEMA.md. Decision still pending.
- **Shame-free language:** CONFIRMED — design requirement, not a preference.
