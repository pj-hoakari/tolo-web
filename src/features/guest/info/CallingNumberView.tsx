export type CallingNumberViewProps = {
  callingNumber: number;
};

export function CallingNumberView({ callingNumber }: CallingNumberViewProps) {
  return (
    <div className="flex flex-col items-center justify-center">
      <h1 className="text-xl mb-4">現在の呼び出し番号</h1>
      <p className="text-lg">{callingNumber} 番</p>
    </div>
  );
}
