package database

import (
	"net/http"
	"os"
	"testing"
	"time"
)

var platforms = []string{
	"darwin",
	"linux",
	"windows",
}

func tmpDir(t *testing.T) string {
	dir, err := os.MkdirTemp("/tmp", "prisma-client-go-test-fetchEngine-")
	if err != nil {
		t.Fatal(err)
	}
	return dir
}

func TestFetchEngine(t *testing.T) {
	dir := tmpDir(t)
	//goland:noinspection GoUnhandledErrorResult
	defer os.RemoveAll(dir)

	engine := NewEngine(&http.Client{
		Timeout: time.Second * 5,
	}, nil, dir)

	var engines = []string{"query-engine", "migration-engine"}

	for _, engineName := range engines {
		if err := engine.FetchEngine(dir, engineName, engine.BinaryPlatformName()); err != nil {
			t.Fatalf("FetchEngine failed for %s: %s", engineName, err)
		}
	}
}

func TestEngineAvailability(t *testing.T) {
	dir := tmpDir(t)
	//goland:noinspection GoUnhandledErrorResult
	defer os.RemoveAll(dir)

	engine := NewEngine(&http.Client{
		Timeout: time.Second * 5,
	}, nil, dir)

	var engines = []string{"query-engine", "migration-engine"}

	for _, engineName := range engines {
		for _, platform := range platforms {
			url := engine.GetEngineURL(engineName, platform)
			resp, err := http.Head(url)
			if err != nil || resp.StatusCode != 200 {
				t.Fatalf("Engine %s unavaiable for platform %s", engineName, platform)
			}
		}
	}
}
