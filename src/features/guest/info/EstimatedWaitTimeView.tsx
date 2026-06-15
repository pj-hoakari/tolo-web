export type EstimatedWaitTimeViewProps = {
  minutes: number;
};

export function EstimatedWaitTimeView({ minutes }: EstimatedWaitTimeViewProps) {
  return (
    <div className="flex flex-col items-center justify-center">
      <h1 className="text-xl mb-4">推定待ち時間</h1>
      <p className="text-lg">約 {minutes} 分</p>
    </div>
  );
}
