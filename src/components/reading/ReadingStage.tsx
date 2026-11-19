import type { ReactNode } from "react";

export function ReadingStage({
  poster,
  facts,
  map,
}: {
  poster: ReactNode;
  facts?: ReactNode;
  map: ReactNode;
}) {
  return (
    <div className="stage">
      <div className="stage-read">
        <div className="reading-card">{poster}</div>
      </div>
      {facts ? <div className="stage-facts">{facts}</div> : null}
      {map}
    </div>
  );
}
