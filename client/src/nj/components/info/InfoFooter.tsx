/* eslint-disable i18next/no-literal-string */
/* ^ We're not worried about i18n for this app ^ */

export default function InfoFooter() {
  return (
    <p>
      If you have any feedback for us or want to request new features —{' '}
      <a href="https://nj.gov" className="underline hover:no-underline">
        send us a message
      </a>
    </p>
  );
}
