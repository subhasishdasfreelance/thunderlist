import { type CSSProperties, type ReactNode, useId } from "react";
import {
	DESIGNS,
	type DesignId,
	type Shape,
	type ShapeSpec,
} from "#/schemas/backdrop-designs";

/**
 * One background design, drawn to fill whatever holds it: the whole page
 * behind a screen, or a thumbnail in the picker; see `DESIGNS`.
 *
 * Shapes are sized in `cqmax` — percent of the holder's longer side — which
 * is what lets the same design be a page and a thumbnail at once.
 */
export function BackdropArt({
	designId,
	colors,
}: {
	designId: DesignId;
	colors: readonly [string, string, string];
}) {
	// Plain letters, so it can be named in `url(#…)` as it is.
	const id = useId().replace(/[^\w-]/g, "");
	const design = DESIGNS.find((each) => each.designId === designId);
	if (design === undefined) return null;

	return (
		<div
			className="thunderlist-backdrop"
			style={
				{
					"--deco-1": colors[0],
					"--deco-2": colors[1],
					"--deco-3": colors[2],
				} as CSSProperties
			}
		>
			{design.shapes.map((spec: ShapeSpec, index) => (
				<ShapeArt
					// A design's shapes never change order; the index is its name.
					// biome-ignore lint/suspicious/noArrayIndexKey: see above.
					key={index}
					spec={spec}
					paintId={`${id}-${index}`}
				/>
			))}
		</div>
	);
}

function ShapeArt({ spec, paintId }: { spec: ShapeSpec; paintId: string }) {
	const from = `var(--deco-${spec.color})`;
	const to = `var(--deco-${(spec.color % 3) + 1})`;
	const paint = spec.fade ? `url(#${paintId})` : from;
	const { viewBox, draw } = SHAPE_ART[spec.shape];

	return (
		<svg
			className="thunderlist-shape"
			viewBox={viewBox}
			aria-hidden="true"
			style={{
				left: `${spec.x}%`,
				top: `${spec.y}%`,
				width: `${spec.size}cqmax`,
				rotate: `${spec.rotate ?? 0}deg`,
			}}
		>
			{spec.fade ? (
				<defs>
					<linearGradient id={paintId} x1="0" y1="0" x2="1" y2="1">
						<stop offset="0" style={{ stopColor: from }} />
						<stop offset="1" style={{ stopColor: to }} />
					</linearGradient>
				</defs>
			) : null}
			{draw(paint, paintId)}
		</svg>
	);
}

/** Filled, in the shape's paint. */
const fill = (d: string) => (paint: string) => <path d={d} fill={paint} />;

/** A thick line, in the shape's paint. */
const line = (d: string, width: number) => (paint: string) => (
	<path
		d={d}
		fill="none"
		stroke={paint}
		strokeWidth={width}
		strokeLinecap="round"
		strokeLinejoin="round"
	/>
);

const SHAPE_ART: Record<
	Shape,
	{ viewBox: string; draw: (paint: string, id: string) => ReactNode }
> = {
	disc: {
		viewBox: "0 0 100 100",
		draw: (paint) => <circle cx="50" cy="50" r="50" fill={paint} />,
	},
	ring: {
		viewBox: "0 0 100 100",
		draw: (paint) => (
			<circle
				cx="50"
				cy="50"
				r="42"
				fill="none"
				stroke={paint}
				strokeWidth="16"
			/>
		),
	},
	blob: {
		viewBox: "0 0 100 100",
		draw: fill(
			"M52 4C74 3 94 18 97 42 100 66 86 90 62 96 38 102 12 90 5 66-2 42 22 5 52 4Z",
		),
	},
	pebble: {
		viewBox: "0 0 100 100",
		draw: fill(
			"M30 12C52-2 86 8 95 34 104 60 84 92 54 95 24 98 2 78 3 52 4 34 14 22 30 12Z",
		),
	},
	puddle: {
		viewBox: "0 0 100 60",
		draw: fill(
			"M8 30C6 14 24 4 46 6 60 7 70 2 84 6 98 10 100 30 94 42 86 56 62 58 44 56 26 54 10 46 8 30Z",
		),
	},
	capsule: {
		viewBox: "0 0 100 30",
		draw: (paint) => <rect width="100" height="30" rx="15" fill={paint} />,
	},
	squircle: {
		viewBox: "0 0 100 100",
		draw: (paint) => <rect width="100" height="100" rx="30" fill={paint} />,
	},
	triangle: {
		viewBox: "0 0 100 90",
		draw: fill("M44 8Q50 0 56 8L97 76Q101 86 90 86H10Q-1 86 3 76Z"),
	},
	dome: {
		viewBox: "0 0 100 50",
		draw: fill("M0 50A50 50 0 0 1 100 50Z"),
	},
	arch: {
		viewBox: "0 0 100 54",
		draw: line("M8 54A42 42 0 0 1 92 54", 16),
	},
	wave: {
		viewBox: "0 0 200 40",
		draw: line("M0 20C25 4 50 4 75 20S125 36 150 20 175 4 200 20", 12),
	},
	zigzag: {
		viewBox: "0 0 200 40",
		draw: line("M4 32 28 8 52 32 76 8 100 32 124 8 148 32 172 8 196 32", 8),
	},
	flower: {
		viewBox: "0 0 100 100",
		draw: (paint) => (
			<g fill={paint}>
				<circle cx="50" cy="26" r="24" />
				<circle cx="74" cy="50" r="24" />
				<circle cx="50" cy="74" r="24" />
				<circle cx="26" cy="50" r="24" />
				<circle cx="50" cy="50" r="24" />
			</g>
		),
	},
	quarter: {
		viewBox: "0 0 100 100",
		draw: fill("M0 0A100 100 0 0 1 100 100H0Z"),
	},
	diamond: {
		viewBox: "0 0 100 100",
		draw: fill(
			"M50 2Q54 2 57 6L94 44Q98 50 94 56L57 94Q50 100 43 94L6 56Q2 50 6 44L43 6Q46 2 50 2Z",
		),
	},
	crescent: {
		viewBox: "0 0 100 100",
		// A disc with a smaller one taken out of its upper right.
		draw: (paint, id) => (
			<>
				<defs>
					<mask id={`${id}-bite`}>
						<rect width="100" height="100" fill="white" />
						<circle cx="68" cy="36" r="36" fill="black" />
					</mask>
				</defs>
				<circle cx="50" cy="50" r="46" fill={paint} mask={`url(#${id}-bite)`} />
			</>
		),
	},
	plus: {
		viewBox: "0 0 100 100",
		draw: fill(
			"M38 0h24a6 6 0 0 1 6 6v26h26a6 6 0 0 1 6 6v24a6 6 0 0 1-6 6H68v26a6 6 0 0 1-6 6H38a6 6 0 0 1-6-6V68H6a6 6 0 0 1-6-6V38a6 6 0 0 1 6-6h26V6a6 6 0 0 1 6-6z",
		),
	},
	stripes: {
		viewBox: "0 0 100 100",
		draw: (paint, id) => (
			<>
				<defs>
					<pattern
						id={`${id}-stripes`}
						width="12"
						height="12"
						patternUnits="userSpaceOnUse"
						patternTransform="rotate(45)"
					>
						<rect width="6" height="12" fill={paint} />
					</pattern>
				</defs>
				<circle cx="50" cy="50" r="50" fill={`url(#${id}-stripes)`} />
			</>
		),
	},
	leaf: {
		viewBox: "0 0 60 100",
		draw: fill("M30 0C58 22 58 78 30 100 2 78 2 22 30 0Z"),
	},
	cloud: {
		viewBox: "0 0 100 56",
		draw: fill(
			"M22 56C10 56 2 48 2 38 2 28 10 21 20 21 22 9 33 2 45 2 57 2 66 9 69 19 71 18 74 18 76 18 90 18 98 28 98 38 98 48 90 56 78 56Z",
		),
	},
	hill: {
		viewBox: "0 0 200 60",
		draw: fill("M0 60C30 20 70 4 100 4S170 20 200 60Z"),
	},
};
