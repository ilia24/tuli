# Tuli, the AI Buddy - Technical Strategy

## 1. Executive Summary

This document outlines the technical architecture for an AI-powered conversational companion designed to guide children through multiple learning journeys. The system will integrate into a game environment where the AI buddy acts as a non-prescriptive coach, facilitating discovery rather than instruction. Our approach will leverage state-of-the-art large language models (LLMs) with rigorous safety constraints, privacy-first data handling, and continuous evaluation infrastructure. The strategy is designed to move from a Proof of Concept (PoC) to a production-ready Minimum Viable Product (MVP) within months.

## 2. LLM Integration Architecture

The conversational engine will be built on commercial foundation models accessed via API, with a vendor-agnostic abstraction layer that allows us to evaluate and switch providers (OpenAI, Anthropic, Google, and others) without significant architectural changes.

The core control mechanism will be a modular prompt architecture. System prompts will define the AI buddy's personality, tone, and behavioral boundaries. Few-shot prompting will provide curated example conversations that enforce coaching style and constrain responses to pedagogically appropriate patterns. This approach keeps the system fully LLM-driven while maintaining tight control over output behavior. Other prompting techniques will be explored and used in the proper scenarios (Chain-of-Thought, Meta-prompting, etc.).

Context window management will ensure coherent multi-turn conversations. As sessions grow, summarization strategies will compress earlier turns to preserve relevant context without exceeding token limits.

For future iterations beyond MVP, we will explore fine-tuning on curated conversational data, model distillation for latency and cost optimization, and potentially on-device inference for offline scenarios.

## 3. Knowledge Retrieval Architecture

The AI buddy will not rely solely on the foundation model's pretrained knowledge. For pedagogically critical content, we will implement a Retrieval-Augmented Generation (RAG) pipeline that grounds the AI's responses in factual, expert-crafted material.

We will collaborate with child psychology specialists and pedagogical experts to author the source content: emotional learning frameworks, age-appropriate guidance strategies, and validated techniques. While specific partnerships are being formalized, we will engage professionals with expertise in child emotional development and evidence-based intervention techniques. This content will be indexed in a vector store and retrieved at inference time based on conversational context. The LLM will then reason over this retrieved evidence, ensuring responses are anchored in authoritative, specialist-approved information rather than generic model outputs.

To maximize retrieval accuracy, we will implement a hybrid search strategy combining vector search for semantic meaning with keyword search for precise term matching. We recognize that children do not use clinical terms. A child saying "my tummy hurts" needs to map to expert concepts like anxiety or stress responses. To address this, we will implement a query expansion layer that uses a lightweight model to internally translate the child's natural language into expert keywords and game-specific proper nouns before executing the search. While vector search captures general emotional sentiment, the expanded keyword search ensures precise retrieval of specific intervention techniques (e.g., "5-4-3-2-1 grounding") that vector embeddings alone might miss.

This architecture provides two key benefits. First, it ensures accuracy and safety by grounding responses in vetted material. Second, it enables content iteration without model changes. Specialists can update guidance, and the system reflects those updates immediately.

## 4. Guardrails Engineering

Child safety is the non-negotiable priority. Our engineering principle is explicit: the system should appear limited before it causes harm.

The guardrails architecture will operate in layers. The input layer will apply content classification to detect inappropriate or off-topic messages from users, alongside prompt injection detection to prevent adversarial manipulation. The output layer will validate every response against strict content policies, applying toxicity filtering and boundary enforcement before delivery.

To illustrate concretely: if a child attempts to steer the conversation toward an unrelated or inappropriate topic, the input classifier will flag the message. The system will then bypass LLM generation entirely and respond with a pre-authored, deterministic message such as "I am not sure how to help with that, but I would love to continue our adventure together." This ensures that uncertain situations never produce uncertain outputs.

When the model's confidence is low, or the conversation drifts outside defined boundaries, the system will default to these deterministic safe responses rather than generating uncertain content. This fallback architecture ensures graceful degradation.

Beyond rule-based guardrails, we will explore advanced safety measures for post-MVP iterations. Constitutional AI and Reinforcement Learning from AI Feedback (RLAIF) offer pathways to embed safety constraints and tone directly into model weights via fine-tuning, reducing reliance on external filters. We will also schedule dedicated red teaming phases where human experts attempt to break safety protocols using adversarial techniques, continuously stress-testing our defenses.

Additionally, async review flags will allow human oversight on edge cases, enabling continuous review and intervention hooks without disrupting the user experience.

## 5. Safeguarding and Escalation Protocol

Given the vulnerable user population, we will implement a dedicated safeguarding protocol. If a child discloses abuse, self-harm, or other serious concerns, the system will not attempt to counsel or respond dynamically. Instead, it will deliver a carefully crafted, static response designed with child safety experts, and immediately flag the session for human review. Depending on the deployment context and regulatory requirements, this may trigger notification to a parent, guardian, or appropriate authority.

The system will be trained to recognize distress signals and safeguarding triggers through keyword detection and contextual classification. We adopt a conservative approach: over-flagging is acceptable, under-flagging is not.

## 6. Data Pipeline and Privacy Architecture

Data privacy will be architected as a first-class concern, not an afterthought. GDPR compliance is our baseline, with child data protection principles guiding every design decision. We will monitor evolving regulations, including COPPA and the Age Appropriate Design Code, to ensure continued compliance as we scale.

A PII sanitization pipeline will process all child inputs before they reach the LLM. Named entity recognition will identify and scrub personally identifiable information, ensuring the foundation model never receives raw sensitive data. We will implement a secondary validation layer that audits sanitization effectiveness, with automated alerts if potential PII leakage is detected. In such cases, the affected session will be flagged, logged, and reviewed.

The data flow will maintain strict segregation between what we store internally (encrypted, access-controlled) and what external LLM providers see (anonymized, stateless). We will enforce a zero data retention policy with third-party providers, ensuring child conversations are not used for model training or stored beyond the inference request.

We will enforce a strict Time-To-Live (TTL) on raw audio data. Raw voice recordings will be auto-deleted immediately after the session processing is complete, ensuring no sensitive voice biomarkers are retained longer than necessary.

## 7. Evaluation Framework

LLMs are non-deterministic by nature. The same prompt can yield different outputs, and prompt changes can introduce regressions. Continuous evaluation infrastructure is essential.

Our evaluation framework will include an automated eval suite (LLM-as-a-judge) that scores responses across safety compliance, tone adherence, and pedagogical alignment. Safety compliance will be measured through automated classifiers that flag policy violations. Tone adherence will be evaluated against rubrics co-developed with child development specialists. Pedagogical alignment will be assessed by comparing AI responses against expert-authored "ideal" responses for benchmark scenarios. This will enable regression testing whenever prompts are updated, ensuring changes improve quality without introducing new failure modes. A/B testing infrastructure will support controlled experimentation with prompt variations.

Comprehensive logging and observability will provide full conversation tracing, enabling debugging, anomaly detection, and iterative improvement based on real interaction patterns.

## 8. Memory System

Personalization is what transforms a generic assistant into a true companion that understands each child's unique journey. 

While the emotional learning curriculum remains consistent at the macro level, the AI buddy will adapt its approach to every individual child. This adaptive layer is where real value emerges: two children navigating the same anger management journey will experience different conversations tailored to their age, personality, vocabulary, and pace.

This level of personalization is achievable with state-of-the-art memory architectures. The memory system will implement a hybrid structure operating at three levels.

A structured user profile stored as JSON will maintain concrete facts such as "child has a dog" or "child's favorite color is blue." These anchors allow the AI to reference the child's world naturally, building rapport and trust. This structured approach also enables deterministic retrieval and straightforward compliance with GDPR "Right to be Forgotten" requests, as specific data points can be surgically removed without affecting the broader system.

Vector memory will complement the structured profile by capturing softer, semantic patterns: how this child typically expresses frustration, what metaphors resonate with them, and how they responded to previous techniques. This enables retrieval of contextually relevant history even when exact terms differ across sessions, allowing the AI to meet the child where they are emotionally.

Short-term memory will maintain immediate conversation state within a single session, ensuring coherent dialogue and appropriate callbacks to earlier moments in the interaction.

Together, these layers enable the AI buddy to remember, learn, and evolve alongside each child. The result is a companion that feels genuinely attentive rather than scripted.

Privacy will remain paramount: stored representations will be anonymized, never raw PII. The memory layer will operate on encrypted, segregated storage with strict access controls.

## 9. Voice Pipeline (MVP)

The transition from text to voice in the MVP introduces significant technical considerations. We will integrate speech-to-text (STT) for input and text-to-speech (TTS) for output, evaluating providers based on accuracy, latency, and child voice recognition quality.

Voice introduces new risks that text does not. Misheard inputs can lead to nonsensical or inappropriate LLM responses. To mitigate this, we will implement confidence thresholds on STT output; low-confidence transcriptions will trigger clarification prompts rather than direct LLM processing. Additionally, the TTS voice will be carefully selected to convey warmth and age-appropriateness, reinforcing the companion experience.

Latency is critical for natural conversation. We will architect the voice pipeline to minimize round-trip time, including evaluating streaming STT/TTS options and optimizing API call sequences.

## 10. Risk and Mitigation

We identify the following key risks and corresponding mitigations:

**Technical risk:** LLM produces an inappropriate response despite guardrails.  
**Mitigation:** Layered defense architecture, deterministic fallbacks, and comprehensive logging for post-hoc review and continuous improvement.

**Privacy risk:** PII sanitization fails and personal data reaches the LLM provider.  
**Mitigation:** Secondary audit layer with automated detection and alerting. Incident response protocol includes session quarantine and review.

**Safeguarding risk:** Child discloses serious harm and system responds inadequately.  
**Mitigation:** Dedicated escalation protocol with static responses and human review triggers.

**Sustainability risk:** LLM API costs become prohibitive at scale.  
**Mitigation:** Cost modeling is underway. Strategies include prompt optimization to reduce token usage, model distillation for lower-cost inference, and exploring tiered usage patterns.

**Vendor lock-in risk:** LLM provider changes API, pricing, or discontinues service.  
**Mitigation:** Vendor-agnostic abstraction layer enables switching providers without big architectural changes.

**Retrieval accuracy risk:** Children's natural language doesn't match expert terminology, causing failed or irrelevant retrieval.  
**Mitigation:** Hybrid search strategy with query expansion layer translates child language to clinical terms.

**Adversarial manipulation risk:** Prompt injection attacks attempt to bypass safety constraints.  
**Mitigation:** Dedicated prompt injection detection at the input layer.

## 11. Multi-Agent Architecture (Post-MVP)

Beyond the MVP, we will evolve the system from a single conversational agent to a multi-agent architecture. Each sub-agent will be specialized for a specific emotional domain (one agent optimized for guiding children through anger, another for sadness, another for anxiety, and so on). Specialization allows deeper prompt engineering, tailored few-shot examples, and domain-specific guardrails for each emotional context.

An orchestrator agent will sit above these specialized agents, responsible for routing conversations to the appropriate sub-agent based on detected emotional context and managing transitions between them. This architecture enables modular development: new emotional domains can be added as independent agents without disrupting existing functionality.

The multi-agent approach also opens the door to more sophisticated behaviors: agents that collaborate, hand off context cleanly, and provide a more nuanced, adaptive companion experience as the product matures.

## 12. Infrastructure and Roadmap

### PoC

The PoC will validate core technical assumptions with a lightweight stack: direct API integration with a foundation model, baseline prompt architecture, and essential guardrails. The interface will be text-based and web-deployed. Evaluation will be manual, focused on verifying conversation quality and safety behavior. Success criteria: the AI buddy guides a child through simple conversations.

### MVP (Target: end of April 2026)

The MVP will introduce voice-based interaction via speech-to-text and text-to-speech pipeline integration. The memory system (short and long-term) will be fully implemented. Automated evaluation and monitoring infrastructure will replace manual review. The architecture will be deployed on a scalable cloud infrastructure with modular components to support expanded content and journeys.

### Post-MVP

The multi-agent architecture will be developed, enabling specialized emotional domain agents and orchestration. Fine-tuning and advanced optimization techniques will be explored for improved performance and cost efficiency.

## 13. Technical Leadership

The technical strategy will be led by a senior engineer with ten years of software development experience and direct, hands-on expertise building AI companions in the mental health domain, including shipping a functional product leveraging generative AI for sensitive conversational contexts.
