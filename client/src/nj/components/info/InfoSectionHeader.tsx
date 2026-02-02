interface InfoSectionHeaderProps {
  text: string;
}

export default function InfoSectionHeader({ text }: InfoSectionHeaderProps) {
  return <h2 className="mb-4 text-2xl">{text}</h2>;
}
