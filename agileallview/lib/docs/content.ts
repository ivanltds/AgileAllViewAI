export type DocBlock =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "note"; title: string; text: string };

export type DocSection = {
  id: string;
  title: string;
  blocks: DocBlock[];
};

export const DOC_TITLE = "AgileAllView — Guia de Configuração e Uso";

export const DOC_SECTIONS: DocSection[] = [
  {
    id: "intro",
    title: "Visão geral",
    blocks: [
      {
        type: "p",
        text:
          "O AgileAllView é um painel de visibilidade para Azure DevOps Boards. Ele sincroniza itens de trabalho (PBIs, User Stories, Tasks, Bugs e Defects), revisões e capacidades para gerar métricas e visões gerenciais e operacionais: fluxo, sprints, backlog, qualidade e capacidade.",
      },
      {
        type: "note",
        title: "Importante",
        text:
          "A ferramenta não substitui seu processo. Ela reflete o que está configurado no Azure Boards (tipos, estados, colunas e campos). Quanto mais consistente estiver o seu fluxo no Azure, mais confiáveis serão os indicadores.",
      },
    ],
  },
  {
    id: "azure-prereq",
    title: "Pré-requisitos mínimos no Azure Boards",
    blocks: [
      {
        type: "p",
        text:
          "A seguir estão os pré-requisitos mínimos para o AgileAllView coletar e exibir dados corretamente.",
      },
      {
        type: "ul",
        items: [
          "Projeto e Time (Team) configurados no Azure DevOps.",
          "Iterations (Sprints) configuradas com datas de início e término.",
          "Backlog Items (ex: Product Backlog Item e/ou User Story) sendo usados para representar demanda.",
          "Tasks/child work items para representar execução (quando aplicável).",
          "Uso consistente de State e BoardColumn para refletir o status real do trabalho.",
        ],
      },
      {
        type: "note",
        title: "Iterations",
        text:
          "As visões de Sprints dependem de iterações com datas preenchidas. Se o time não usa datas ou usa iterações sem time_frame/intervalos consistentes, os gráficos por sprint podem ficar incompletos.",
      },
    ],
  },
  {
    id: "work-item-types",
    title: "Tipos de itens de trabalho suportados",
    blocks: [
      {
        type: "p",
        text:
          "O AgileAllView considera os seguintes tipos (Work Item Types), de acordo com a configuração atual:",
      },
      {
        type: "ul",
        items: [
          "Product Backlog Item (PBI) e User Story: itens principais de demanda (work_items).",
          "Defect: considerado como ‘defeito’ de nível PBI (work_items).",
          "Bug: considerado como bug de nível ‘child’ (work_item_children) — pode existir também como item principal em processos legados.",
          "Task: itens filhos (child) usados para execução/capacidade (dependendo do time/processo).",
        ],
      },
      {
        type: "note",
        title: "Defects como filhos",
        text:
          "Alguns processos criam Defects como itens filhos. A ferramenta também considera Defects em children para métricas de qualidade e KPI de defeitos abertos.",
      },
    ],
  },
  {
    id: "required-fields",
    title: "Campos relevantes (mínimo recomendado)",
    blocks: [
      {
        type: "p",
        text:
          "A ferramenta usa campos padrão do Azure DevOps. Estes são os campos mais importantes para uma leitura correta:",
      },
      {
        type: "ul",
        items: [
          "System.Id, System.Title",
          "System.WorkItemType",
          "System.State",
          "System.IterationPath (e o nome da iteração/sprint)",
          "System.AssignedTo",
          "System.CreatedDate, System.ChangedDate",
          "Microsoft.VSTS.Common.ClosedDate (para determinar conclusão)",
          "System.BoardColumn e System.BoardColumnDone (para leitura de fluxo)",
          "Microsoft.VSTS.Scheduling.Effort (quando o time usa esforço)",
          "Microsoft.VSTS.Common.Priority (prioridade)",
          "Microsoft.VSTS.Common.Severity (severidade — para Bugs/Defects)",
        ],
      },
      {
        type: "note",
        title: "Esforço (Effort)",
        text:
          "O campo Effort pode representar horas ou pontos, conforme o processo do seu time. Na UI, o modo ‘Esforço’ aparece como ‘h/pts’ justamente porque a unidade depende do seu uso.",
      },
    ],
  },
  {
    id: "states-columns",
    title: "Status (State) e colunas (BoardColumn)",
    blocks: [
      {
        type: "p",
        text:
          "As visões de backlog e fluxo dependem da qualidade do State e do BoardColumn. Boas práticas:",
      },
      {
        type: "ul",
        items: [
          "Evite múltiplos estados diferentes para o mesmo significado (ex: ‘Done’, ‘Concluído’, ‘Feito’).",
          "Mantenha colunas do board alinhadas com o fluxo real (To Do / Doing / Done, ou equivalente).",
          "Garanta que itens finalizados recebam ClosedDate (normalmente automático ao mudar para Done).",
        ],
      },
    ],
  },
  {
    id: "auth",
    title: "Autenticação (como funciona hoje)",
    blocks: [
      {
        type: "p",
        text:
          "A autenticação é feita via Personal Access Token (PAT) do Azure DevOps. O PAT é informado na tela de login e validado pela API (/api/validate).",
      },
      {
        type: "ul",
        items: [
          "O PAT NÃO é armazenado em banco de dados.",
          "O PAT é mantido somente em memória (sessão do navegador) e é descartado ao fechar a aba.",
          "Tokens são gerenciados por Organização: ao abrir times de outra org, a aplicação solicita o PAT daquela org e troca o token ativo.",
          "O sync (/api/sync) recebe o PAT no corpo da requisição e usa-o apenas durante aquela sincronização.",
        ],
      },
      {
        type: "note",
        title: "Permissões recomendadas no PAT",
        text:
          "No mínimo, o PAT precisa de permissão para ler Work Items, Iterations, Teams e Capacities do Azure DevOps. Se o PAT não tiver escopo suficiente, a validação ou o sync podem falhar.",
      },
    ],
  },
  {
    id: "filters",
    title: "Filtros (como funcionam)",
    blocks: [
      {
        type: "p",
        text:
          "O dashboard permite filtrar por sprints e por período (datas). O comportamento padrão também é importante:",
      },
      {
        type: "ul",
        items: [
          "Se você selecionar uma ou mais sprints, as métricas usam essas sprints.",
          "Se você selecionar período (de/até), as sprints são filtradas por faixa de datas.",
          "Sem filtros (nenhuma sprint/período), as visões de Visão Geral, Backlog e Sprints exibem todos os itens em aberto.",
        ],
      },
    ],
  },
  {
    id: "overview",
    title: "Visão: Visão Geral",
    blocks: [
      {
        type: "p",
        text:
          "A Visão Geral concentra KPIs e gráficos para dar contexto rápido sobre a saúde do time.",
      },
      {
        type: "ul",
        items: [
          "KPIs: Lead Time, Cycle Time, Throughput, Completion Rate (dependendo do período).",
          "KPIs de Qualidade: Bugs abertos (child) e Defeitos abertos (PBI/child Defect).",
          "Gráfico Planejado vs Realizado (por sprint): mostra Planejado, Concluído e Extras. Possui seletor para Quantidade vs Esforço.",
        ],
      },
      {
        type: "note",
        title: "Planejado vs Realizado (conceitos)",
        text:
          "Planejado = itens presentes no sprint no início (snapshot). Concluído = itens concluídos dentro do período do sprint. Extras = itens adicionados após o início do sprint e concluídos no mesmo sprint.",
      },
    ],
  },
  {
    id: "backlog",
    title: "Visão: Backlog / PBIs",
    blocks: [
      {
        type: "p",
        text:
          "A visão de Backlog lista os itens principais (PBI/User Story/Defect) e permite expandir para ver itens filhos (Tasks/Bugs/Defect children).",
      },
      {
        type: "ul",
        items: [
          "Busca e ordenação por colunas.",
          "Destaque visual para Defects no backlog.",
          "Expansão para carregar filhos via /api/workitems/[teamId]/children.",
          "Resumo de remaining work por PBI (quando disponível nos filhos).",
        ],
      },
      {
        type: "note",
        title: "Modo sem filtro",
        text:
          "Sem seleção de sprints/período, o backlog mostra itens em aberto (não Done/Removed). Isso ajuda a enxergar o estoque atual de trabalho.",
      },
    ],
  },
  {
    id: "sprints",
    title: "Visão: Sprints",
    blocks: [
      {
        type: "p",
        text:
          "A visão de Sprints organiza métricas sprint a sprint e apresenta cards com planejado, realizado, extra e carry-over.",
      },
      {
        type: "ul",
        items: [
          "Cards por sprint: Planejado, Realizado, Extra, Carry Over e Lead Time médio.",
          "Seletor Quantidade vs Esforço nos cards.",
          "Detalhamento dos itens por coluna/estado (dependendo do que o backend retorna para o período).",
        ],
      },
    ],
  },
  {
    id: "quality",
    title: "Visão: Qualidade",
    blocks: [
      {
        type: "p",
        text:
          "A visão de Qualidade traz gráficos de pizza (pie charts) para Severidade, Prioridade e Estado, separados entre Bugs e Defeitos.",
      },
      {
        type: "ul",
        items: [
          "Bugs: itens filhos do backlog (work_item_children) do tipo Bug.",
          "Defeitos: itens principais (work_items) do tipo Defect (ou legados) + Defects em children.",
          "Distribuição por Severity, Priority e State para orientar ações de triagem.",
        ],
      },
    ],
  },
  {
    id: "capacity",
    title: "Visão: Capacidade",
    blocks: [
      {
        type: "p",
        text:
          "A visão de Capacidade consolida capacidade planejada vs utilizada (quando disponível) e permite leitura por pessoa.",
      },
      {
        type: "ul",
        items: [
          "Capacidade por pessoa (individualCapacity).",
          "Leitura por atividade (ex: Development, Testing).",
          "Acurácia depende do uso correto de Capacity no Azure DevOps e do apontamento de work.",
        ],
      },
    ],
  },
  {
    id: "simulation",
    title: "Visão: Simulação",
    blocks: [
      {
        type: "p",
        text:
          "A visão de Simulação permite selecionar membros e simular capacidade semanal e por sprint, com quebra por atividade.",
      },
      {
        type: "ul",
        items: [
          "Seleção de membros do time atual.",
          "Opção de incluir membros de outros times (quando disponíveis na fonte de dados).",
          "Geração de cenários para comparação.",
        ],
      },
    ],
  },
];
