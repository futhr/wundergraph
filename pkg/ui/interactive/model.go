package interactive

import (
	"context"
	"fmt"
	"github.com/charmbracelet/bubbles/help"
	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"strings"
	"time"
)

type ServerConfigLoaded struct {
	ServerURL                string
	Webhooks                 int
	Operations               int
	DatasourceConfigurations int
	Authentication           bool
	FileUploads              bool
	PlaygroundEnabled        bool
}

type TaskStarted struct {
	Name string
}

type TaskEnded struct {
	Name string
	Err  error
}

type internalTask struct {
	Name      string
	StartTime time.Time
	Err       error
	Done      bool
}

type model struct {
	keys          keyMap
	help          help.Model
	serverVersion string
	err           error
	quitting      bool
	spinner       spinner.Model
	internalTask  *internalTask
	serverConfig  *ServerConfigLoaded
	viewHeight    int
	viewWidth     int
	ready         bool
}

func (m model) Init() tea.Cmd {
	return tea.Batch(
		m.spinner.Tick,
		tea.EnterAltScreen,
	)
}

type serverURLOpenFinished struct{ err error }

func OpenURL(serverURL string) tea.Cmd {
	return tea.ExecProcess(open(serverURL), func(err error) tea.Msg {
		return serverURLOpenFinished{err}
	})
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var (
		cmd  tea.Cmd
		cmds []tea.Cmd
	)

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch {
		case key.Matches(msg, m.keys.ClearConsole):
			return m, tea.ClearScreen
		case key.Matches(msg, m.keys.OpenBrowser):
			return m, OpenURL(m.serverConfig.ServerURL)
		case key.Matches(msg, m.keys.Quit):
			m.quitting = true
			return m, tea.Quit
		case key.Matches(msg, m.keys.Help):
			m.help.ShowAll = !m.help.ShowAll
		}
	case tea.WindowSizeMsg:
		if !m.ready {
			m.viewHeight = msg.Height
			m.viewWidth = msg.Width
			// If we set a width on the help menu it can gracefully truncate
			// its view as needed.
			m.help.Width = m.viewWidth
			m.ready = true
		}
	case TaskStarted:
		m.internalTask = &internalTask{
			Name: msg.Name,
			Done: false,
			Err:  nil,
		}
	case TaskEnded:
		m.internalTask.Name = msg.Name
		m.internalTask.Done = true
		m.internalTask.Err = msg.Err
	case ServerConfigLoaded:
		m.serverConfig = &msg
	case serverURLOpenFinished:
		if msg.err != nil {
			m.err = msg.err
			return m, tea.Quit
		}
	case spinner.TickMsg:
		m.spinner, cmd = m.spinner.Update(msg)
		return m, cmd
	}

	return m, tea.Batch(cmds...)
}

func (m model) View() string {
	if !m.ready {
		return "\n  Initializing..."
	}
	if m.quitting {
		return "\n  Quitting..."
	}

	docStyle := lipgloss.NewStyle().Padding(1, 2, 1, 2)

	if m.internalTask.Done {
		doc := strings.Builder{}
		if m.internalTask.Err != nil {
			doc.WriteString(fmt.Sprintf("%s %s\n", FailStyle.Render("FAIL"), m.internalTask.Err.Error()))
			return docStyle.Render(doc.String())
		}
	}

	doc := strings.Builder{}

	title := HeadlineTextStyle.Render("WunderGraph")
	versionString := HeadlineTextStyle.Render(fmt.Sprintf("(%s)", m.serverVersion))

	doc.WriteString(fmt.Sprintf("%s %s\n\n", title, versionString))

	if m.serverConfig != nil && m.serverConfig.ServerURL != "" {
		serverURL := lipgloss.JoinHorizontal(lipgloss.Left,
			BoldStyle.Render("➜ Local: "),
			FeintStyle.Render(m.serverConfig.ServerURL),
		)
		doc.WriteString(fmt.Sprintf("%s\n", serverURL))

		if m.serverConfig.PlaygroundEnabled {
			graphiQL := lipgloss.JoinHorizontal(lipgloss.Left,
				lipgloss.NewStyle().Foreground(Color).Render("➜ Playground: "),
				fmt.Sprintf("%s/graphql", m.serverConfig.ServerURL),
			)
			doc.WriteString(fmt.Sprintf("%s\n", graphiQL))
		}

		logModeHint := lipgloss.JoinHorizontal(lipgloss.Left,
			lipgloss.NewStyle().Foreground(Feint).Render("➜ Logs: use "),
			BoldStyle.Bold(true).Render("--verbose"),
			lipgloss.NewStyle().Foreground(Feint).Render(" to see logs"),
		)
		doc.WriteString(fmt.Sprintf("%s\n\n", logModeHint))
	}

	if m.internalTask.Done {
		if m.internalTask.Err == nil {
			doc.WriteString(fmt.Sprintf("%s %s\n", PassStyle.Render("SUCCESS"), m.internalTask.Name))
		}
	} else {
		doc.WriteString(fmt.Sprintf("%s %s\n", m.spinner.View(), m.internalTask.Name))
	}

	doc.WriteString("\n")

	if m.serverConfig != nil {
		authText := DisabledStyle.Render("✖ Auth")
		if m.serverConfig.Authentication {
			authText = TextStyle.Render("✔ Auth")
		}

		fileUploadText := DisabledStyle.Render("✖ File Uploads")
		if m.serverConfig.FileUploads {
			fileUploadText = TextStyle.Render("✔ File Uploads")
		}

		doc.WriteString(
			lipgloss.JoinHorizontal(lipgloss.Left, fmt.Sprintf("%s\n%s\n%s\n",
				lipgloss.NewStyle().Foreground(Orange).PaddingRight(2).Render(fmt.Sprintf("%d DataSources", m.serverConfig.DatasourceConfigurations)),
				lipgloss.NewStyle().Foreground(Rose).PaddingRight(2).Render(fmt.Sprintf("%d Operations", m.serverConfig.Operations)),
				lipgloss.NewStyle().Foreground(Green).PaddingRight(2).Render(fmt.Sprintf("%d Webhooks", m.serverConfig.Webhooks)),
			), fmt.Sprintf("%s\n%s\n",
				authText,
				fileUploadText,
			)),
		)

		doc.WriteString("\n")
	}

	helpView := m.help.View(m.keys)

	doc.WriteString(helpView + "\n")

	return docStyle.Render(doc.String())

}

type Options struct {
	ServerVersion string
}

func NewModel(ctx context.Context, options *Options) *tea.Program {
	s := spinner.New()
	s.Spinner = spinner.Dot
	s.Style = lipgloss.NewStyle().Foreground(lipgloss.Color("205"))

	model := model{
		keys:          keys,
		help:          help.New(),
		serverVersion: options.ServerVersion,
		spinner:       s,
		internalTask:  &internalTask{},
	}

	p := tea.NewProgram(
		model,
		tea.WithContext(ctx),
		tea.WithAltScreen(),
	)

	return p
}