interface InfoHeaderProps {
  text: string;
}

export default function InfoTitle({ text }: InfoHeaderProps) {
  return <h1 className="mb-6 text-3xl font-bold">{text}</h1>;
}
