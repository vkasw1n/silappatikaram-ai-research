"""Create the existing-versus-proposed system comparison chart."""

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt


METRICS = [
    "Knowledge\nCoverage",
    "Retrieval\nAccuracy",
    "Contextual\nUnderstanding",
    "Relationship\nDiscovery",
    "Reasoning\nAccuracy",
    "Evidence\nTraceability",
]
EXISTING_SYSTEM = [45, 52, 38, 34, 40, 28]
PROPOSED_SYSTEM = [82, 86, 78, 76, 84, 88]


def create_comparison_chart(output_path: str | Path = "comparison.png") -> Path:
    """Save the comparison chart and return its resolved output path."""
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    x_values = range(len(METRICS))
    figure, axis = plt.subplots(figsize=(10, 4.8), dpi=180)

    axis.plot(
        x_values,
        EXISTING_SYSTEM,
        color="#1764d1",
        marker="o",
        linewidth=2,
        markersize=5,
        label="Existing System",
    )
    axis.plot(
        x_values,
        PROPOSED_SYSTEM,
        color="#ef1d1d",
        marker="s",
        linewidth=2,
        markersize=5,
        label="Proposed System",
    )

    for positions, values, color in (
        (x_values, EXISTING_SYSTEM, "#1764d1"),
        (x_values, PROPOSED_SYSTEM, "#ef1d1d"),
    ):
        for position, value in zip(positions, values):
            axis.annotate(
                f"{value}%",
                (position, value),
                xytext=(0, 7),
                textcoords="offset points",
                ha="center",
                color=color,
                fontsize=9,
                fontweight="bold",
            )

    axis.set_title("Comparison of Existing System and Proposed System", fontweight="bold")
    axis.set_ylabel("Performance (%)")
    axis.set_xlabel("Evaluation Metrics")
    axis.set_xticks(list(x_values), METRICS, fontsize=8)
    axis.set_ylim(0, 100)
    axis.set_yticks(range(0, 101, 20))
    axis.grid(axis="y", linestyle="--", linewidth=0.6, alpha=0.35)
    axis.spines["top"].set_visible(False)
    axis.spines["right"].set_visible(False)
    axis.legend(loc="lower center", bbox_to_anchor=(0.5, -0.28), ncol=2, frameon=True)

    figure.tight_layout()
    figure.savefig(output, bbox_inches="tight", facecolor="white")
    plt.close(figure)
    return output.resolve()


if __name__ == "__main__":
    print(create_comparison_chart("ProjectDocument/5/comparison.png"))
