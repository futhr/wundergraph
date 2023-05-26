package trace

import (
	"net/http"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel/trace"
)

// NewTransport wraps the provided http.RoundTripper with one that
// enriches the span with the operation name and type and set the span status
// Internally it uses otelhttp.NewTransport to instrument the request
func NewTransport(base http.RoundTripper, opts ...otelhttp.Option) http.RoundTripper {
	transport := &transport{
		rt: base,
	}

	return otelhttp.NewTransport(
		transport, opts...,
	)
}

type transport struct {
	rt http.RoundTripper
}

func (t *transport) RoundTrip(r *http.Request) (*http.Response, error) {
	span := trace.SpanFromContext(r.Context())

	// Set the operation name and type
	SetOperationAttributes(r.Context())

	res, err := t.rt.RoundTrip(r)

	// In case of an error the span status is set to error
	// by the otelhttp.RoundTrip function

	SetStatus(span, res.StatusCode)

	return res, err
}
