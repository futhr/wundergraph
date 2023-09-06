package codegeneration

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"text/template"
)

var (
	wunderGraphServerTemplate = template.Must(template.New(serverEntryPointFilename).Parse(`
// Code generated by wunderctl. DO NOT EDIT.

import { startWunderGraphServer } from "@wundergraph/sdk/server";
import serverConfig from "../../wundergraph.server";
{{ if .HasApplicationConfig }}import config from "../../wundergraph.config";{{ end }}

{{ if .HasApplicationConfig }}startWunderGraphServer({
	...serverConfig,
	integrations: config.integrations,
});{{ else }}startWunderGraphServer(serverConfig);{{ end }}`,
)))

type wunderGraphServerTemplateData struct {
	HasWunderGraphServerTs bool
	HasApplicationConfig bool
}

func generateWunderGraphServerTS(wunderGraphDir string) (string, error) {
	st, err := os.Stat(filepath.Join(wunderGraphDir, "wundergraph.server.ts"))
	if err != nil && !os.IsNotExist(err) {
		return "", err
	}

	defaultEntryPoint := filepath.Join(wunderGraphDir, configEntryPointFilename)
	hasApplication, err := hasApplicationConfig(defaultEntryPoint)

	data := &wunderGraphServerTemplateData{
		HasWunderGraphServerTs: err == nil && !st.IsDir(),
		HasApplicationConfig: hasApplication,
	}
	generated := filepath.Join(wunderGraphDir, generatedDirectory, "server")
	var buf bytes.Buffer
	if err := wunderGraphServerTemplate.Execute(&buf, data); err != nil {
		return "", err
	}
	if err := os.MkdirAll(generated, os.ModePerm); err != nil {
		return "", fmt.Errorf("error creating %s: %s", generated, err)
	}
	entryPointFilename := filepath.Join(generated, serverEntryPointFilename)
	if err := os.WriteFile(entryPointFilename, buf.Bytes(), 0644); err != nil {
		return "", fmt.Errorf("error creating %s: %s", entryPointFilename, err)
	}
	return entryPointFilename, nil
}

func ServerEntryPoint(wunderGraphDir string) (string, error) {
	return generateWunderGraphServerTS(wunderGraphDir)
}
