package scan

import (
	"context"
	"fmt"
)

type Result struct {
	Path    string
	Matches int
}

// Inspect keeps cancellation visible at each boundary.
func Inspect(ctx context.Context, paths []string) ([]Result, error) {
	results := make([]Result, 0, len(paths))
	for _, path := range paths {
		if err := ctx.Err(); err != nil {
			return nil, fmt.Errorf("inspect %s: %w", path, err)
		}
		results = append(results, Result{Path: path, Matches: 42})
	}
	return results, nil
}
