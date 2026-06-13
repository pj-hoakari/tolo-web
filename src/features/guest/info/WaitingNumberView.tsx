export type WaitingNumberViewProps = {
  waitingNumber: number;
};

export function WaitingNumberView({ waitingNumber }: WaitingNumberViewProps) {
  return (
    <div className="flex flex-col items-center justify-center">
      <h1 className="text-xl mb-4">現在の待ち人数</h1>
      <p className="text-lg">{waitingNumber} 人</p>
    </div>
  );
}
