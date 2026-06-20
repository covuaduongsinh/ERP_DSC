{{/*
Expand the name of the chart.
*/}}
{{- define "vierp.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "vierp.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "vierp.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "vierp.labels" -}}
helm.sh/chart: {{ include "vierp.chart" . }}
{{ include "vierp.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "vierp.selectorLabels" -}}
app.kubernetes.io/name: {{ include "vierp.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Get app name from app key
*/}}
{{- define "vierp.appName" -}}
{{- $appKey := . }}
{{- if eq $appKey "hrm_unified" }}hrm-unified{{ end }}
{{- if eq $appKey "mrp" }}mrp{{ end }}
{{- if eq $appKey "accounting" }}accounting{{ end }}
{{- if eq $appKey "ecommerce" }}ecommerce{{ end }}
{{- if eq $appKey "otb" }}otb{{ end }}
{{- if eq $appKey "tpm_api" }}tpm-api{{ end }}
{{- if eq $appKey "docs" }}docs{{ end }}
{{- if eq $appKey "crm" }}crm{{ end }}
{{- if eq $appKey "pm" }}pm{{ end }}
{{- if eq $appKey "excelaI" }}excelaI{{ end }}
{{- if eq $appKey "tpm_web" }}tpm-web{{ end }}
{{- end }}

{{/*
Create image reference
*/}}
{{- define "vierp.imageRef" -}}
{{- $registry := .global.imageRegistry }}
{{- $imageName := .appConfig.image }}
{{- $tag := .global.imageTag }}
{{- printf "%s/%s:%s" $registry $imageName $tag }}
{{- end }}

{{/*
Get full app name for resource naming
*/}}
{{- define "vierp.appFullname" -}}
{{- include "vierp.fullname" .root }}-{{ include "vierp.appName" .appKey }}
{{- end }}

{{/*
App-specific labels
*/}}
{{- define "vierp.appLabels" -}}
{{ include "vierp.labels" .root }}
vierp.io/app: {{ include "vierp.appName" .appKey }}
{{- end }}

{{/*
App-specific selector labels
*/}}
{{- define "vierp.appSelectorLabels" -}}
{{ include "vierp.selectorLabels" .root }}
vierp.io/app: {{ include "vierp.appName" .appKey }}
{{- end }}
