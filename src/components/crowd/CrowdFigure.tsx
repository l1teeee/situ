import { memo } from "react";
import type { Figure } from "@/domain/crowd/figure";
import { faceTransform } from "@/components/crowd/faceTransform";

function CrowdFigure({ figure }: { figure: Figure }) {
  return (
    <g data-figure={figure.id} transform={`translate(${figure.x} ${figure.y})`}>
      <g data-part="body">
        <path data-part="outline" d={figure.outlinePath} />
        <g data-part="arms" visibility="hidden" fill={figure.handColor}>
          <path data-part="arm-left" d={figure.armPath} />
          <path data-part="arm-right" d={figure.armPath} />
        </g>
        <g data-part="face" transform={faceTransform(figure, 0, 0)} fill="none">
          <g data-part="serious-face">
            <g data-part="serious-eyes">
              <path d={figure.eyesPath} strokeWidth={figure.eyeWidth} />
            </g>
            <path d={figure.linesPath} />
          </g>
          <g data-part="happy-face" visibility="hidden">
            <g data-part="happy-eyes">
              <path d={figure.happyEyesPath} />
            </g>
            <path d={figure.happyLinesPath} />
          </g>
        </g>
      </g>
    </g>
  );
}

export default memo(CrowdFigure);
