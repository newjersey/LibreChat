/* eslint-disable i18next/no-literal-string */
/* ^ We're not worried about i18n for this app ^ */

import InfoSectionHeader from '~/nj/components/info/InfoSectionHeader';
import InfoLink from '~/nj/components/info/InfoLink';

export default function AiLearning() {
  return (
    <div>
      <InfoSectionHeader text="AI Learning Resources" />
      <div className="mb-6 space-y-3">
        <strong>NJ State-Developed Learning Resources</strong>
        <p className="mb-2">
          Responsible Use of GenAI training - Available on the Learning Management System
        </p>

        <InfoLink
          text="NJ Innovation Skills & Resources - Written by NJIA"
          link="https://innovation.nj.gov/skills/"
          aria-label="NJ Innovation Skills & Resources (opens in new window)"
          icon="launch"
        />

        <InfoLink
          text=" GenAI How-To Guides - (includes how to build tools and improve call center menus with GenAI)"
          link="https://innovation.nj.gov/skills/ai-how-tos/"
          aria-label="GenAI How-To Guides (opens in new window)"
          icon="launch"
        />
      </div>
      <div className="mb-6 space-y-3">
        <strong>Other Resources</strong>
        <InfoLink
          text="InnovateUS trainings about AI"
          link="https://innovate-us.org/"
          aria-label="InnovateUS trainings about AI (opens in new window)"
          icon="launch"
        />
        <InfoLink
          text="UK Government Prompt Library"
          link="https://ai.gov.uk/knowledge-hub/prompts"
          aria-label="UK Government Prompt Library (opens in new window)"
          icon="launch"
        />
        <InfoLink
          text="Anthropic’s prompt engineering guide - including how to"
          link="https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview"
          aria-label="Anthropic’s prompt engineering guide (opens in new window)"
          icon="launch"
        />
        <InfoLink
          text="Anthropic's guidance to reduce hallucinations"
          link="https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations"
          aria-label="Anthropic's guidance to reduce hallucinations (opens in new window)"
          icon="launch"
        />
        <p className="mb-6">
          (Note: Claude is not an approved tool, do not put any state data into the tool)
        </p>
      </div>
    </div>
  );
}
