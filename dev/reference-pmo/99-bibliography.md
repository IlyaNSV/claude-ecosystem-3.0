# 99. Библиография источников

> **Назначение:** консолидированный список источников из разделов 01-13. Группированы по школам / типам. Per источник: тип (Book/Paper/Blog/Doc/Standard), confidence level (per agent research notes), primary URL.
>
> **Confidence flags:**
> - **Verified** — URL/title checked при подготовке references; источник существует в описанной форме.
> - **High** — derived from agent training knowledge; high recall confidence на book/paper title и concept; URL may have moved (verify before publication).
> - **Medium** — book/concept solid; specific URL path не verified.
> - **Low** — flagged as low canonical confidence by agent research; **DO NOT cite as authoritative** without independent verification.

---

## 99.1 Product Discovery & Strategy

### Books (MATURE-ISH)

- **Marty Cagan, *Inspired: How to Create Tech Products Customers Love* (2nd ed., Wiley, 2017).** — High confidence. Используется в разделах 01, 02, 04, 05, 12. svpg.com/inspired/.
- **Marty Cagan, *Empowered: Ordinary People, Extraordinary Products* (with Chris Jones, Wiley, 2020).** — High. Используется в 01, 02, 04, 12. svpg.com/empowered/.
- **Marty Cagan, *Transformed: Moving to the Product Operating Model* (Wiley, 2024).** — High. Используется в 01.
- **Teresa Torres, *Continuous Discovery Habits* (Product Talk LLC, 2021).** — High. Используется в 01, 04, 12. producttalk.org.
- **Eric Ries, *The Lean Startup* (Crown, 2011).** — High. Используется в 01, 02, 04, 12. theleanstartup.com.
- **Eric Ries, *The Startup Way* (Crown, 2017).** — Medium. Расширение Lean Startup для enterprise.
- **Steve Blank, *The Four Steps to the Epiphany* (2005).** — Medium. Upstream methodology, на которую ссылается Ries. steveblank.com.
- **Clayton Christensen et al., *Competing Against Luck* (Harper Business, 2016).** — High. JTBD Christensen school. Используется в 04. hbr.org/product/competing-against-luck.
- **Anthony Ulwick, *Jobs to be Done: Theory to Practice* (2016).** — High. JTBD ODI school. Используется в 04. strategyn.com/jobs-to-be-done/.
- **Anthony Ulwick, *What Customers Want* (2005).** — Medium. Upstream Ulwick.
- **Alan Klement, *When Coffee and Kale Compete* (2018).** — High. JTBD switch interviews. Используется в 04, 13. jtbd.info/.
- **Alex Osterwalder, *Business Model Generation* (Wiley, 2010).** — High. BMC. Используется в 12.
- **Alex Osterwalder & Yves Pigneur, *Value Proposition Design* (Wiley, 2014).** — High. VPC. Используется в 04. strategyzer.com/library.
- **David J. Bland & Alex Osterwalder, *Testing Business Ideas* (Wiley, 2019).** — High. Test Card / Learning Card. Используется в 04.
- **Dave McClure, «Startup Metrics for Pirates» (2007 SlideShare).** — Medium. AARRR. URL has moved; ищи «Dave McClure pirate metrics» SlideShare.
- **Sean Ellis & Morgan Brown, *Hacking Growth* (2017).** — Medium. NSM popularization.
- **John Doerr, *Measure What Matters* (2018).** — High. OKRs. Используется в 12. whatmatters.com.
- **Jeff Gothelf & Josh Seiden, *Lean UX* (3rd ed., O'Reilly, 2021).** — High. Hypothesis canvas; assumption mapping. jeffgothelf.com.

### Web / Practitioner

- **SVPG.com (Cagan et al.) blog and articles.** — High. svpg.com/articles/.
- **producttalk.org (Torres blog).** — High. Includes Opportunity Solution Tree primer. producttalk.org/opportunity-solution-tree/.
- **Strategyzer library.** — High. strategyzer.com/library.
- **Amplitude North Star Playbook.** — High. amplitude.com/north-star.
- **GV Design Sprint resource.** — Medium. gv.com/sprint/.

### Concepts flagged with caveats

- **«H.A.R.M.E.D.» framework** — **Low confidence.** Помечен по agent research как community/coaching mnemonic without primary source. Used inadvertently в твоём `processes.md` §3.1.A. **Recommendation:** swap to «Strategyzer Test Card» or «Lean UX hypothesis» reference for citation safety.

---

## 99.2 Engineering Specification & Quality

### Books (MATURE)

- **Eric Evans, *Domain-Driven Design: Tackling Complexity in the Heart of Software* (Addison-Wesley, 2003).** — Verified. The Blue Book. Используется в 04, 07, 09, 12, 13. domainlanguage.com/ddd/reference/.
- **Vaughn Vernon, *Implementing Domain-Driven Design* (Addison-Wesley, 2013).** — Verified. The Red Book. Используется в 07, 09, 13.
- **Vaughn Vernon, *Domain-Driven Design Distilled* (Addison-Wesley, 2016).** — High.
- **Alberto Brandolini, *Introducing EventStorming* (Leanpub).** — High. Используется в 12. eventstorming.com.
- **Gojko Adzic, *Specification by Example* (Manning, 2011).** — High. Используется в 04, 05, 07, 13. gojko.net/books/specification-by-example/.
- **Gojko Adzic, *Bridging the Communication Gap* (2009).** — Medium.
- **Gojko Adzic, *Impact Mapping* (Provoking Thoughts, 2012).** — High. Используется в 12. impactmapping.org.
- **Gojko Adzic, *Fifty Quick Ideas to Improve Your User Stories* (2014).** — Medium.
- **Karl Wiegers & Joy Beatty, *Software Requirements*, 3rd ed. (Microsoft Press, 2013).** — Verified. Используется в 06, 07, 13.
- **Mike Cohn, *User Stories Applied* (Addison-Wesley, 2004).** — Verified. Используется в 04, 05.
- **Mike Cohn, *Agile Estimating and Planning* (Prentice Hall, 2005).** — High. Используется в 03 (spike management).
- **Bertrand Meyer, *Object-Oriented Software Construction* (2nd ed., Prentice Hall, 1997).** — High. Design by Contract. Используется в 04.
- **Brett Whittaker, *Exploratory Software Testing* (Addison-Wesley, 2009).** — Medium. Используется в 03.
- **Adam Shostack, *Threat Modeling: Designing for Security* (Wiley, 2014).** — High. STRIDE methodology. Используется в 03, 06, 12. shostack.org.
- **Wynne & Hellesoy, *The Cucumber Book* (Pragmatic, 2017).** — High. BDD/Gherkin practical guide.
- **Brad Frost, *Atomic Design* (2013, self-published).** — Verified. Используется в 04. atomicdesign.bradfrost.com.
- **Jesse James Garrett, *The Elements of User Experience* (New Riders, 2010).** — Medium. Используется в 04.
- **Bass, Clements, Kazman, *Software Architecture in Practice* (4th ed., Addison-Wesley, 2021).** — High. ATAM, quality attribute scenarios. Используется в 03, 08, 12.
- **Jez Humble & David Farley, *Continuous Delivery* (Addison-Wesley, 2010).** — Verified. Используется в 03, 04. continuousdelivery.com.
- **Forsgren, Humble, Kim, *Accelerate* (IT Revolution, 2018).** — High. DORA metrics; D3 capabilities. Используется в 03, 12.
- **Beyer, Jones, Petoff, Murphy (eds.), *Site Reliability Engineering* (O'Reilly, 2016).** — Verified. Free online: sre.google/sre-book. Используется в 02, 03, 04, 06, 12.
- **Kent Beck, *Test-Driven Development: By Example* (Addison-Wesley, 2002).** — Verified.
- **Robert C. Grady, *Practical Software Metrics* (Prentice Hall, 1992).** — Medium. FURPS+ origin.

### Standards / Documentation

- **ISO/IEC 25010:2011 / 2023, Software Product Quality Model.** — Verified. iso25000.com/index.php/en/iso-25000-standards/iso-25010. Используется в 02, 03, 04, 06.
- **ISO/IEC/IEEE 29148, Requirements Engineering.** — Verified. Используется в 06, 07.
- **ISTQB Foundation Level Syllabus.** — Verified. istqb.org. Используется в 03, 04.
- **DO-178C** (Software Considerations in Airborne Systems) — Verified. Используется как пример safety-critical traceability standard. RTCA.
- **IEC 62304** (Medical device software) — Verified.
- **ISO 26262** (Functional safety automotive) — Verified.
- **AIAG-VDA FMEA Handbook (4th ed., 2019).** — High. FMEA standard.
- **OpenAPI Initiative.** — Verified. openapis.org.
- **OWASP Top 10.** — Verified. owasp.org/Top10.
- **SLSA framework.** — Verified. slsa.dev. Используется в 07, 09, 13.
- **NIST Cybersecurity Framework.** — Verified. nist.gov/cyberframework.

### Papers

- **Liu et al., «Lost in the Middle: How Language Models Use Long Contexts»** (Stanford, 2023) — arxiv.org/abs/2307.03172. Используется в 10.
- **Mavin et al., «Easy Approach to Requirements Syntax (EARS)»** (IEEE RE'09, 2009).** — High. alistairmavin.com/ears/. Используется в 12 (O-01).
- **Gotel & Finkelstein, «An Analysis of the Requirements Traceability Problem»** (IEEE 1994).** — High. RTM foundational paper. Используется в 07, 13.
- **Sandhu et al., «Role-Based Access Control Models»** (IEEE 1996).** — Verified. RBAC origin paper. Используется в 04.
- **David Harel, «Statecharts: A Visual Formalism for Complex Systems»** (Sci. of Computer Programming, 1987).** — Verified. Используется в 04.

### Practitioner Sources

- **Dan North, «Introducing BDD» (2006).** — Verified. dannorth.net/introducing-bdd/. Используется в 04, 05.
- **Cucumber documentation.** — Verified. cucumber.io/docs/. Gherkin reference: cucumber.io/docs/gherkin/.
- **Martin Fowler bliki.** — Verified. martinfowler.com/bliki. Используется для Bounded Context, Anemic Domain Model, Ubiquitous Language entries.
- **Simon Brown, c4model.com.** — Verified. C4 model documentation. Используется в 03, 12.
- **Michael Nygard, «Documenting Architecture Decisions» (2011).** — Verified. cognitect.com/blog/2011/11/15/documenting-architecture-decisions. Используется в 06, 11.
- **MADR (Markdown Architectural Decision Records).** — Verified. adr.github.io/madr/.
- **Salesforce Design Tokens.** — Verified. lightningdesignsystem.com.
- **Adobe Spectrum design system.** — Verified. spectrum.adobe.com.

### Risk / Decision

- **Gary Klein, «Performing a Project Premortem» (HBR Sep 2007).** — Verified. hbr.org/2007/09/performing-a-project-premortem. Используется в 03, 08, 13.
- **Daniel Kahneman, *Thinking, Fast and Slow* (Farrar Straus Giroux, 2011).** — Verified. Используется в 08.
- **Microsoft STRIDE.** — Verified. learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats. Используется в 03, 06.

### Methodology / Process

- **Scrum Guide (Schwaber & Sutherland).** — Verified. scrumguides.org. Используется в 05, 06, 11.
- **Wake INVEST criteria for stories.** — Verified. xp123.com/articles/invest-in-good-stories-and-smart-tasks/. Используется в 04.
- **Robert Cooper, Stage-Gate methodology.** — High. stage-gate.com. Используется в 03, 11.

### Strategy

- **Simon Wardley, *Wardley Maps* (CC-licensed Medium book).** — High. Используется в 12.

---

## 99.3 AI-native / Agentic / Confidence

### Anthropic Publications

- **Anthropic, «Building effective agents» (2024).** — Verified. anthropic.com/engineering/building-effective-agents. Используется в 01, 05, 08, 10, 13.
- **Anthropic, «How we built our multi-agent research system» (2024).** — Verified. anthropic.com/engineering/built-multi-agent-research-system.
- **Anthropic, «Writing tools for agents» (June 2025).** — Verified. anthropic.com/engineering/writing-tools-for-agents. Используется в 10.
- **Anthropic Skills overview.** — Verified. docs.claude.com/en/docs/agents-and-tools/agent-skills/overview. Используется в 10.
- **Anthropic Claude Code hooks.** — Verified. docs.claude.com/en/docs/claude-code/hooks. Используется в 10.
- **Anthropic Claude Code Skills.** — Verified. docs.claude.com/en/docs/claude-code/skills.
- **Anthropic Memory.** — Verified. anthropic.com/news/memory. Используется в 10.
- **Anthropic «Constitutional AI» paper (2022).** — Verified. arxiv.org/abs/2212.08073. Используется в 01, 08, 10, 11.
- **Anthropic introspection research.** — Medium. anthropic.com/research/introspection.
- **Anthropic prompting long-context guidance.** — Verified. anthropic.com/news/prompting-long-context.

### Research papers

- **Sharma et al., «Towards Understanding Sycophancy in Language Models»** (Anthropic, 2023). — Verified. arxiv.org/abs/2310.13548. Используется в 01, 08, 13.
- **Perez et al., «Discovering Language Model Behaviors with Model-Written Evaluations»** (Anthropic, 2022). — Verified. arxiv.org/abs/2212.09251.
- **Tian et al., «Just Ask for Calibration»** (Stanford, 2023). — Verified. arxiv.org/abs/2305.14975. Используется в 01, 08, 10.
- **Lin et al., «Teaching Models to Express Uncertainty in Words»** (2022). — Verified. arxiv.org/abs/2205.14334. Используется в 10.
- **Kadavath et al., «Language Models (Mostly) Know What They Know»** (Anthropic, 2022). — Verified. arxiv.org/abs/2207.05221. Используется в 01, 08, 10, 13.
- **Yao et al., «ReAct: Synergizing Reasoning and Acting»** (2022). — Verified. arxiv.org/abs/2210.03629.
- **Madaan et al., «Self-Refine: Iterative Refinement with Self-Feedback»** (2023). — Verified. arxiv.org/abs/2303.17651.
- **MemGPT paper (Packer et al., 2023).** — Verified. arxiv.org/abs/2310.08560. Используется в 10.

### OpenAI publications

- **OpenAI Agents SDK documentation.** — Verified. openai.github.io/openai-agents-python/.
- **OpenAI function calling guide.** — Verified. platform.openai.com/docs/guides/function-calling. Используется в 10.
- **OpenAI «Sycophancy in GPT-4o» (April 2025 incident report).** — Verified. openai.com/index/sycophancy-in-gpt-4o/. Используется в 01, 08.
- **OpenAI Evals.** — Verified. github.com/openai/evals. Используется в 10.

### LangChain ecosystem

- **Lance Martin, «Context Engineering for Agents»** (LangChain blog, 2024-2025). — Medium. blog.langchain.com/context-engineering-for-agents/. Используется в 10.
- **Lance Martin, «Context Engineering» blog post.** — Medium. rlancemartin.github.io/2025/06/23/context_engineering/.
- **LangGraph multi-agent docs.** — Verified. langchain-ai.github.io/langgraph/concepts/multi_agent/. Используется в 10.
- **LangGraph memory docs.** — Verified. langchain-ai.github.io/langgraph/concepts/memory/. Используется в 10.

### Other AI ecosystem

- **CrewAI documentation.** — Verified. docs.crewai.com.
- **AutoGen (Microsoft) documentation.** — Verified. microsoft.github.io/autogen/.
- **Letta (formerly MemGPT).** — Verified. docs.letta.com.

### Practitioner blogs

- **Hamel Husain, «Your AI product needs evals»** (2024). — Verified. hamel.dev/blog/posts/evals/. Используется в 10, 12.
- **Eugene Yan, «Evaluating LLMs»** (2023+). — Verified. eugeneyan.com/writing/evals/. Используется в 10.

### Tools

- **promptfoo documentation.** — Verified. promptfoo.dev. Используется в 10.
- **Anthropic evals cookbook.** — Verified. github.com/anthropics/anthropic-cookbook.

---

## 99.4 Architecture / Boundaries

- **Alistair Cockburn, «Hexagonal architecture» (2005).** — Verified. alistair.cockburn.us/hexagonal-architecture/. Используется в 09.
- **Building a Second Brain (Tiago Forte, 2022).** — Medium. Используется в 04.

---

## 99.5 Citation safety reminders

Per agent research notes:

1. **Web access denied для some research.** URLs derived from training knowledge; verify before publication. Domain roots (svpg.com, producttalk.org, anthropic.com) are reliable; specific blog post slugs may have moved.
2. **«H.A.R.M.E.D.» reference** — low confidence; не cite as authoritative. Already flagged в §99.1.
3. **Christensen vs Ulwick JTBD** — public disagreement on what «job» is. If citing «JTBD», specify school.
4. **Lean Startup academic critiques** (Felin, Gans, Stern, Zenger 2020) — known critique of Ries; relevant if claiming Ries-style hypothesis-testing as universally appropriate. Не cited explicitly в этом референсе, но noted for awareness.
5. **ISO 25010 revision** — 2023 update may include «Safety» as added characteristic; verify exact list at iso25000.com before citing specific characteristic count.

---

## 99.6 Maturity classification recap (per overview §6)

| Класс | Примеры в этой библиографии |
|---|---|
| **MATURE** (20-40 лет) | DDD (Evans 2003), BDD (North 2006), RTM (Wiegers 1993+), ISO 25010, FMEA, RBAC, AC patterns, Refactoring (Fowler 1999), Continuous Delivery (Humble & Farley 2010), Threat Modeling (Shostack 2014) |
| **MATURE-ISH** (10-20 лет) | Lean Startup (Ries 2011), JTBD (Christensen 2016, Ulwick 2016), Strategyzer canvases (2010-2014), OKRs (Doerr 2018), NSM (Ellis 2017), Continuous Discovery (Torres 2021), DDD Distilled (Vernon 2016), Atomic Design (Frost 2013), Specification by Example (Adzic 2011), *Accelerate* (Forsgren 2018) |
| **EMERGING** (2-5 лет) | Anthropic Skills (2025), Claude Code hooks (2024-2025), Anthropic «Building effective agents» (2024), context engineering как named discipline (2024-2025), Letta/MemGPT (2023-2024), Sharma sycophancy paper (2023), Lance Martin context engineering blog (2024-2025), promptfoo evals (2023+), structured confidence fields (emerging from Tian 2023, Lin 2022) |
| **SPECULATIVE** (<2 лет, limited evidence) | Self-meta-feedback / model-proposed constitutional revisions, fully autonomous multi-agent systems, calibrated verbalized confidence на open-ended generation, drift-check для living spec direction alignment |

---

**Конец bibliography.**

Используется как single source of truth для cross-section citations. Updated when new sources cited в newer sections of the reference.
