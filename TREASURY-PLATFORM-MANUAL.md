# TreasuryIQ — Client User Manual

### How to read your Westpac GTS treasury dashboard, and what to do with it

*Prepared by Westpac Global Transaction Services. This manual accompanies the `treasury-platform.html` mock-up and explains every chart, metric and alert on the platform, and how your treasury team can use each one to make better decisions about cash, funding and risk.*

---

## 1. What this platform is for

TreasuryIQ pulls together three things your treasury team normally has to chase from different places — your bank account data, your own AR/AP and forecasting systems, and market data (FX rates, interest rates) — and turns them into one daily view of:

- **Liquidity** — how much cash you have, where it sits, and where it's going
- **Working capital** — how efficiently that cash moves through your trading cycle
- **Capital & funding** — how your debt is structured, what it costs, and how much headroom you have
- **FX & interest rate risk** — what you're exposed to, and how well it's hedged

The platform does not just report numbers — it generates **insights**: plain-English observations about what has changed and why it matters, with a suggested next step. Think of it as a standing daily briefing from your relationship team, backed by data that updates automatically.

Every figure in the mock-up is illustrative sample data for a fictional company, "Southern Cross Retail Group Ltd." Your live version would reflect your own accounts, entities and currencies.

---

## 2. Overview tab

**Purpose:** a one-screen summary for the CFO or Treasurer — the four numbers that matter most, right now.

### 2.1 Stat tiles (Total group cash, Available liquidity, Cash conversion cycle, Unhedged FX exposure)

**What it shows:** the current value of each metric, the change since the last comparable period (▲/▼), and one line of context.

**How to read it:**

- The **delta colour** tells you the direction of travel at a glance — green is favourable, red means it's moved against you. Note that "favourable" depends on the metric: rising cash is good (green), but rising unhedged FX exposure is flagged even though it uses the same up-arrow convention — always read the context line, not just the colour.
- **Available liquidity** is deliberately broader than cash: it adds your *undrawn* committed facilities, because that's what you could actually access under stress, not just what's sitting in accounts today.

**How to use it:**

- Start every treasury review here. If all four tiles are unremarkable, you likely don't need to dig further that day.
- Use "Available liquidity ÷ next 30-day outflows" (shown as a coverage multiple) as your quick stress check before approving discretionary spend, an acquisition deposit, or an early debt repayment.
- A rising **unhedged FX exposure** tile is a cue to open the FX & Rate Risk tab before it becomes a hedge-ratio breach.

### 2.2 13-week cash flow forecast (chart)

**What it shows:** your consolidated cash balance, week by week. The solid line and darker shading are **actuals** (the last four weeks, as they landed); the dashed line and lighter shading are the **forecast** (the next nine weeks, rebuilt weekly from your AR/AP schedules, payroll runs and known treasury flows such as coupon payments).

**How to read it:**

- The point where solid becomes dashed is "today" — everything to the right is a projection, not a fact.
- The shaded area is not a magnitude scale to compare between weeks; it exists to make the trend line easier to track. Focus on the **line's slope and turning points**.
- Hover over any point (in the live platform) to see the exact balance and whether it's actual or forecast.

**How to use it:**

- Look for the **lowest point on the forecast line** — that is your tightest liquidity week in the coming quarter. If it's uncomfortably close to your internal minimum cash policy, that's your cue to arrange a facility drawdown or delay a discretionary outflow *before* the week arrives, not during it.
- A forecast that keeps sloping down over multiple weekly refreshes (rather than just one bad week) is more informative than a single dip — it usually means a structural change (e.g., a new supplier term, a revenue slowdown) rather than timing noise.
- Because the forecast is rebuilt every week, compare this week's forecast for a given future week against last week's forecast for the *same* week. A forecast that keeps deteriorating for the same week is an early warning sign worth raising with your relationship team.

### 2.3 Cash by currency (chart)

**What it shows:** total group cash broken down by currency, converted to AUD-equivalent for comparison.

**How to read it:** bar length is the AUD-equivalent value; the label is the true balance in that currency.

**How to use it:**

- A currency balance that is large relative to your operating needs in that currency (see the NZD example in the Insights feed) is "trapped" liquidity — it isn't earning what it could and it isn't reducing your AUD borrowing. This chart is where you first notice that build-up; the cash pooling diagram (§3.2) and insights feed tell you what to do about it.

### 2.4 "What needs your attention"

A short list of the two most severe live insights (see §7). This exists so a time-poor reader never has to visit the Insights tab to catch anything urgent — it surfaces automatically on the page you land on first.

---

## 3. Liquidity & Cash tab

**Purpose:** the operational detail behind the Overview's headline cash numbers — where cash actually sits, how it flows week to week, and how it's structurally moved between entities.

### 3.1 Weekly net cash flow (diverging bar chart)

**What it shows:** for each of the same 13 weeks as the Overview forecast, the **net** operating cash flow — inflows minus outflows, *before* any financing activity (drawdowns, repayments, dividends). Bars above the line are net cash generation; bars below are net cash use.

**How to read it:**

- This is a different way of looking at the same underlying forecast as the Overview chart. The Overview chart shows the **running total** (your balance); this chart shows the **weekly change** that produces that total. Use them together: a rising balance line can hide a couple of genuinely bad weeks if strong weeks either side offset them — this chart shows you which individual weeks are the outliers.
- Lighter, dashed-outline bars are forecast weeks; solid bars are actuals.
- Colour here is not identity (it isn't "series A vs series B") — it encodes **sign**. Blue always means net inflow, red always means net outflow, regardless of which week it is.

**How to use it:**

- Identify recurring negative weeks (e.g., a payroll-heavy week, a quarterly tax or coupon week) and make sure your facility headroom (§4.3) is sized to absorb the largest one comfortably, not just the average week.
- A string of forecast weeks getting redder over successive refreshes, even if the cumulative balance still looks fine, is worth a conversation — it usually means outflows are being pulled forward or inflows pushed back.

### 3.2 Liquidity coverage (gauge)

**What it shows:** your available liquidity expressed as a multiple of forecast net outflows over a given horizon (30-day headline figure, with 90-day shown in the table underneath). The black tick mark on the gauge is your internally agreed minimum policy level.

**How to read it:** the further the green arc extends past the tick mark, the more buffer you're carrying above your own policy floor.

**How to use it:**

- This is the single number to quote in a board pack when asked "are we liquid enough?" It already nets together cash, undrawn facilities and the forecast, so it answers the question directly rather than requiring the reader to combine three other numbers themselves.
- If the 90-day coverage ratio is markedly lower than the 30-day figure, that tells you your liquidity buffer is adequate for near-term shocks but thinner further out — a useful early input to funding planning (Capital & Funding tab) well before it becomes urgent.

### 3.3 Cash pooling structure (diagram)

**What it shows:** how cash notionally concentrates from your operating entities into the group master account at end of day, and the balance currently sitting in each entity.

**How to use it:**

- This is a structural reference, not a daily-decision chart — use it to sanity-check that the sweep structure is actually pulling cash to where it can be used (i.e., no entity should be building an unexplained balance if it's meant to be swept nightly). If an entity's balance here is larger than expected, cross-check it against the entity/currency table below and the Insights feed, which is where a build-up like this gets flagged with a specific recommendation.

### 3.4 Cash by entity & currency (table)

**What it shows:** the full breakdown behind the summary chart — every entity's balance in every currency it holds, plus a AUD-equivalent total.

**How to use it:** the reference table for treasury operations and for reconciling against your own TMS or ERP cash position. Use it to spot balances sitting in an entity or currency with no natural operating need (a candidate for sweeping, investing, or using to pay down debt in that currency).

---

## 4. Working Capital tab

**Purpose:** how much cash is tied up in the operating cycle, and whether that's improving, worsening, or in line with peers.

### 4.1 DSO / DIO / DPO stat tiles

**What they show:**

- **DSO (Days Sales Outstanding)** — how long, on average, it takes customers to pay you after a sale.
- **DIO (Days Inventory Outstanding)** — how long stock sits before it's sold.
- **DPO (Days Payable Outstanding)** — how long you take to pay your own suppliers.

**How to use it:** each tile calls out *why* it moved (e.g., "Driven by SX New Zealand Ltd") wherever the platform can attribute the change to a specific entity — use that attribution to go straight to the right conversation instead of investigating from scratch.

### 4.2 Cash conversion cycle — trailing 6 quarters (line chart)

**What it shows:** DSO, DIO and DPO plotted together over the last six quarters. The **Cash Conversion Cycle (CCC)** itself is DSO + DIO − DPO — the net number of days cash is tied up before it comes back to you.

**How to read it:**

- Each line is a distinct, named metric (not a ranked series), which is why each has its own fixed colour and a legend.
- Watch DSO and DPO relative to each other: if DSO is rising while DPO is flat, you are increasingly financing your customers' payment terms out of your own working capital.

**How to use it:**

- A shorter cash conversion cycle means less cash is trapped in the business, which is cash you don't have to borrow. Use the trend to judge whether working-capital initiatives (tighter credit terms, better stock turn, renegotiated supplier terms) are actually landing quarter over quarter — a single-quarter number doesn't tell you that; the trend does.
- If DIO improves but DSO worsens by more, the *net* CCC can still get worse even though one metric looks better — always check the combined number, not just the driver you're focused on.

### 4.3 Vs. peer benchmark (grouped bar chart)

**What it shows:** your DSO, DIO and DPO against a revenue-weighted peer benchmark for your sector.

**How to read it:** your bar is always the coloured one; the benchmark is shown in muted grey specifically so it reads as a *reference line*, not another business unit — it's there for context, not as a target you're being scored against in the same way as an internal metric.

**How to use it:**

- Use gaps here to prioritise. In the sample data, DIO is 6 days worse than peers (more cash tied up in stock than typical for the sector) while DPO is roughly in line — that tells you inventory management, not supplier terms, is the bigger lever.
- Treat "better than benchmark" with some caution too: DPO significantly *higher* than peers might mean efficient supplier terms, or it might mean you're stretching payments in a way that's starting to strain supplier relationships — the number alone doesn't tell you which.

### 4.4 Working capital released / (absorbed) table

**What it shows:** for each driver, the cash impact of a single day's movement, at your current revenue run-rate.

**How to use it:** this converts an abstract "days" metric into a dollar figure your board actually cares about. Use it to build the business case for a working-capital initiative (e.g., "closing the 4-day DSO gap versus twelve months ago is worth $3.4M of freed-up cash") and to prioritise between initiatives of different sizes on a common, comparable basis.

---

## 5. Capital & Funding tab

**Purpose:** the shape of your funding — when it matures, what it costs, how it's sourced, and how much headroom you have left.

### 5.1 Debt maturity ladder (bar chart)

**What it shows:** the principal amount maturing in each future calendar year.

**How to read it:** a tall bar in a single year is a **concentration risk** — that much has to be refinanced (or repaid) in whatever market conditions exist at that time, rather than the risk being spread across years.

**How to use it:**

- Use this as the starting point for refinancing planning: begin structuring the next raise for a tall bar 12–24 months ahead of its year, not in the year itself, so you're not a forced borrower into whatever conditions the market offers at the time.
- If two tall bars sit close together (as in the sample data's 2028 and 2031+ years), consider whether part of one maturity can be pre-financed or termed out earlier to smooth the profile.

### 5.2 Funding mix (donut chart)

**What it shows:** the proportion of committed funding from each source — bank facilities, bonds, commercial paper, and other instruments such as USPP notes.

**How to use it:**

- Diversification across funding sources reduces reliance on any single lender group or market. Use this chart when a covenant or relationship issue arises with one funding type (e.g., bank facilities) to gauge how exposed you are overall.
- A mix heavily weighted to one source (particularly short-tenor sources like commercial paper) alongside a concentrated maturity ladder is a combination worth discussing with your relationship team even if neither looks alarming on its own.

### 5.3 Weighted average cost of funds (line chart)

**What it shows:** your blended cost of funds over time, plotted against the RBA cash rate as a reference line.

**How to read it:** the reference line is shown dashed and in muted grey — the same "reference, not a peer series" treatment used in the working-capital benchmark chart — because it's context for interpreting your own line, not a metric you're being directly compared against.

**How to use it:**

- Watch the **gap** between your line and the cash rate, not just the level of either line alone. A widening gap while the cash rate is flat usually signals rising credit spreads (i.e., markets or lenders pricing you as riskier) rather than base-rate movements, and is worth raising proactively rather than waiting for a refinancing to reveal it.
- A narrowing gap suggests your funding is repricing favourably — a good moment to discuss extending tenor while pricing is attractive.

### 5.4 Facility headroom (utilisation bars)

**What it shows:** for each committed facility, the amount drawn against its limit, the utilisation percentage, and the utilisation level at which your leverage covenant is next tested (the vertical threshold marker).

**How to read it:**

- Each bar carries a **status label** (Healthy / Watch / Breach risk) as well as a colour, so the state is never colour-only — this matters for accessibility, but also because "88% utilised" alone doesn't tell you if that's fine or urgent without knowing where the covenant threshold sits.
- The threshold marker's position varies by facility (90% for most, 95% for the USPP note in the sample) — always read the label next to the marker rather than assuming a single fixed level across all facilities.

**How to use it:**

- This is the chart to check before any decision that would increase drawings on a facility (funding a capex programme, an acquisition, a working-capital swing). A facility already flagged "Watch" or "Breach risk" is the wrong facility to draw further on — use one with more headroom, or address it first via the paydown route this chart implies.
- Treat "Breach risk" as an action item, not a status to monitor passively — by the time a covenant test actually fails, your options (paydown, waiver request, refinancing) are more limited and more expensive than they are today.

---

## 6. FX & Rate Risk tab

**Purpose:** what currency and interest-rate risk the group is carrying, and whether it's within the policy limits your board has approved.

### 6.1 Net FX exposure by currency & tenor (heatmap)

**What it shows:** your unhedged net position in each major currency, broken down by how soon it falls due (0–3 months out to 12 months+), in US-dollar equivalent.

**How to read it:**

- **Blue cells are net receivable** positions — money you're due to receive in that currency, which means you're exposed to that currency *weakening* before you convert it. **Red cells are net payable** positions — money you owe, so you're exposed to that currency *strengthening* before you pay it. This is a **diverging** scale around zero, not a magnitude scale, so a dark blue cell and a dark red cell represent similarly sized exposures pointed in opposite directions, not "good" versus "bad."
- Every cell carries its own printed value — deliberately, since some of the shading is too light to rely on colour alone at a glance.

**How to use it:**

- Near-term columns (0–3m) matter most for hedging decisions, since exposure this close to settlement has the least time to be naturally revised away by the business.
- A currency with **large exposures of the same sign across every tenor** (like USD in the sample, consistently net receivable) is a structural exposure worth a standing hedge programme. A currency that flips sign across tenors is more likely to be a timing effect that will partly net out on its own — worth confirming before hedging the gross amount unnecessarily.

### 6.2 Hedge ratio vs policy band

**What it shows:** for each currency with material exposure, the percentage of your 12-month forecast exposure currently hedged, plotted against your board-approved policy band (the shaded range) and status label.

**How to use it:**

- "In policy" means no action needed. "Below target" is your cue to execute additional forward cover — the chart already tells you the size of the gap (current hedge ratio to the bottom of the band), which is the minimum amount to consider hedging next.
- Use this alongside §6.1: a currency that's both below its hedge target *and* shows a large, consistent net exposure across tenors (as NZD does in the sample when read against a NZD exposure line) is your highest-priority hedging conversation.

### 6.3 Interest rate profile (donut + sensitivity bars)

**What it shows:** the split of your debt between fixed and floating rates, and the estimated annual P&L impact of a 100-basis-point parallel move in interest rates in either direction.

**How to use it:**

- The fixed/floating split is a policy setting, not just an observation — compare it against your board's target range. A floating share that's crept up (often because new drawings default to floating) quietly increases your rate sensitivity even if nobody explicitly decided that.
- The ±100bps figures translate that split into a dollar number your CFO can use directly: "a further 100bps of rate rises costs us $1.8M a year at today's floating balance" is a concrete input into whether to swap more debt to fixed.

---

## 7. Insights & Alerts tab

**Purpose:** the platform's synthesis layer — instead of asking you to notice a pattern across four different tabs, it states the pattern and proposes what to do about it.

### 7.1 How severity is assigned

| Level | Meaning | Typical trigger |
|---|---|---|
| **Critical** | Requires action before the next review cycle | A covenant, limit or hard policy threshold is close to breach |
| **Serious** | Worth resolving soon; not yet at a hard limit | Cash or exposure sitting materially outside its normal operating range |
| **Warning** | Worth understanding; may resolve on its own | A metric trending the wrong way over multiple periods |
| **Good** | No action required | A previously flagged item has returned within policy |

Severity is always shown as an icon **and** a text label together, never colour alone, so the meaning doesn't depend on being able to distinguish similar shades.

### 7.2 Anatomy of an insight card

Each card has the same four parts, always in the same order:

1. **What happened** — the specific, quantified observation (never "cash flow looks concerning" — always "DSO rose from 17 to 21 days").
2. **Where it comes from** — which tab and chart the insight was drawn from, so you can go and inspect the underlying data yourself.
3. **Why it matters** — the mechanism connecting the observation to a consequence (a covenant, a cost, a risk).
4. **Suggested action** — a specific, sized next step, not a vague prompt to "review."

**How to use the feed as a whole:**

- Read it in severity order (as laid out) at the start of each review — it's designed so that a Critical item is never buried below several Good items.
- Use the "suggested action" as a starting point for a conversation with your relationship team, not as an automatic instruction — the platform surfaces what changed and a reasonable option, but sizing and executing the response (a hedge trade, a facility paydown, a credit-term change) remains a decision for your treasury team, informed by context the data alone doesn't capture.
- A "Good" item is worth reading too: it confirms a previous concern has actually been resolved, rather than just having scrolled off the top of the feed.

---

## 8. A suggested weekly routine

A practical way to use the platform week to week:

1. **Monday morning:** Overview tab. Check the four stat tiles and the "what needs your attention" panel. Confirm the 13-week forecast's lowest point is comfortably above your policy minimum.
2. **If anything is flagged:** open Insights & Alerts and work through items in severity order.
3. **Before any facility drawdown or discretionary payment:** check Facility Headroom (Capital & Funding) to confirm you're drawing on a facility with room, and Liquidity Coverage (Liquidity & Cash) to confirm the group-level buffer still holds afterward.
4. **Monthly:** review Working Capital trends and the peer benchmark to track whether initiatives are moving the cash conversion cycle in the right direction.
5. **Quarterly, or after any large FX contract:** review FX exposure and hedge ratios against policy bands, and the debt maturity ladder against your refinancing calendar.

---

## 9. Getting in touch

Every insight and chart on this platform is meant to start a conversation, not replace one. Your Westpac GTS relationship team — led by **Jeff Whitmore, Head of Global Transaction Services** — can help size a hedge, structure a facility increase, or work through any of the actions this manual describes. Use the "Message relationship team" button in the platform, or contact your usual relationship contact directly.

---

*This manual and the accompanying platform (`treasury-platform.html`) are illustrative mock-ups prepared to demonstrate how Westpac Global Transaction Services could present data and analytics to corporate treasury clients. All figures, entity names and insights are fictional sample data and do not reflect any real Westpac client, account or transaction.*
