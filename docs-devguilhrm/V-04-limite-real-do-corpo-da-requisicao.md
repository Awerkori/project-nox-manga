# V-04 — O pacote que dizia pesar 1 byte

## A vulnerabilidade trabalhada

O Project Nox definia limites diferentes para requisições pequenas, avatares e uploads. No hook global, porém, a decisão era baseada somente no header `Content-Length` enviado pelo cliente:

```text
Number(request.headers.get('content-length') || 0) > limite
```

Se o header não existisse, o código considerava tamanho zero. Se o cliente declarasse um valor menor que o corpo real, a aplicação aceitava a declaração. Depois, rotas chamavam `request.text()`, `request.json()`, `request.formData()` ou `request.arrayBuffer()`, materializando o corpo antes de conferir os bytes efetivamente recebidos.

O resultado era uma diferença entre o limite anunciado e o limite realmente aplicado. A infraestrutura da Cloudflare ainda teria seus próprios tetos, mas a proteção de 64 kB da aplicação podia ser contornada.

## Storytelling ofensivo — descoberta por um pentester mal-intencionado

### 1. O reconhecimento

Caio se apresenta como pentester, mas age sem autorização. Como o projeto é open source, ele lê o hook global e identifica a comparação baseada apenas em `Content-Length`. Depois navega pela tela de login e confirma que formulários e chamadas de API retornam 413 quando o navegador envia um valor alto nesse header.

Ao revisar o comportamento, Caio suspeita de uma validação baseada apenas no header. Essa é uma pista conhecida: aplicações frequentemente usam `Content-Length` como se fosse uma medição confiável, embora ele seja apenas uma declaração do remetente e possa estar ausente em corpos transmitidos progressivamente.

### 2. A primeira confirmação

Em vez de usar o navegador, Caio monta um cliente HTTP que controla os headers. Ele envia um POST para uma rota pública de autenticação com:

```http
POST /entrar HTTP/1.1
Host: app.exemplo
Origin: https://app.exemplo
Content-Type: application/x-www-form-urlencoded
Transfer-Encoding: chunked

<muitos chunks até formar um corpo grande>
```

O header `Origin` passa porque um cliente HTTP não está sujeito às restrições de origem do navegador e pode escrever o valor esperado. Como não há `Content-Length`, o hook interpreta o tamanho como zero.

O código antigo chega então a `request.formData()`. Para interpretar o formulário, o runtime acumula o corpo. A aplicação pretendia aceitar no máximo 65.536 bytes, mas só descobre a dimensão depois de já ter alocado memória — e, em algumas rotas, nem fazia uma segunda conferência.

### 3. A segunda confirmação

Caio repete o teste com `Content-Length: 1`, embora envie muitos megabytes. Mesmo que algum proxy normalize essa inconsistência, o simples fato de a aplicação confiar na declaração cria comportamentos diferentes entre ambientes, versões de HTTP e caminhos internos.

O teste de regressão desta correção reproduz exatamente as duas variantes em memória:

- corpo em chunks sem `Content-Length`;
- `Content-Length` menor que a quantidade real de bytes.

Antes da correção, as APIs nativas de parsing receberiam o corpo inteiro. Depois da correção, ambas as variantes terminam em 413 assim que o contador real ultrapassa o limite.

### 4. Transformando a falha em indisponibilidade

Caio abre dezenas de conexões concorrentes e transmite os corpos gradualmente. Cada requisição ocupa memória, tempo de CPU e uma execução do Worker. Ele não precisa acertar senha ou manter sessão; a rota de autenticação precisa ler o formulário para processar a tentativa.

Sob carga, usuários legítimos encontram respostas 5xx, maior latência e falhas no login. Mesmo que a plataforma encerre corpos muito grandes, Caio pode escolher tamanhos abaixo do teto da infraestrutura e muito acima do limite lógico da aplicação. O ataque também consome cota e aumenta custo operacional.

O efeito é uma negação de serviço de camada de aplicação: o atacante transforma parsing e alocação de memória em recurso esgotável.

### 5. Por que os controles existentes não impediam o ataque

- `Origin` reduz CSRF em navegadores; não autentica clientes HTTP.
- `Content-Length` permite rejeição antecipada quando é válido, mas não mede o stream.
- Limites do provedor protegem a plataforma em uma escala maior; não substituem o limite menor definido pelo produto.
- Validar o tamanho depois de `request.text()` ou `request.arrayBuffer()` é tarde demais para evitar a alocação.

## A correção aplicada

Foi criado `src/lib/server/request-body.ts`, com leitores que contam os bytes reais enquanto consomem `request.body`:

- `readRequestBytes()` soma `value.byteLength` de cada chunk;
- ao ultrapassar o limite, cancela o stream e lança 413 imediatamente;
- `readRequestText()` só decodifica um corpo já limitado;
- `readRequestJson()` só executa `JSON.parse` após a limitação;
- `readRequestFormData()` limita primeiro, reconstrói uma requisição pequena e só então chama `formData()`.

O hook continua usando `Content-Length` como rejeição antecipada, mas agora também rejeita valores inválidos. A segurança não depende mais dele: cada endpoint que materializa corpo usa um leitor limitado.

### Rotas protegidas

- ações de membro/editor/owner em `/api/action`;
- login, cadastro, recuperação e redefinição de senha;
- convites e autorização da equipe;
- denúncias e atualização da central de denúncias;
- ações administrativas do importer;
- upload editorial e de avatar via multipart;
- bridge interna de armazenamento com corpo binário.

As rotas Mihon não foram alteradas porque pertencem ao fork declarado fora do escopo deste trabalho.

### Limites efetivos

| Categoria | Limite real aplicado |
| --- | ---: |
| JSON e formulários pequenos | 65.536 bytes |
| `/api/action` | 60.000 bytes |
| Arquivo de avatar | 300.000 bytes + até 100.000 bytes de envelope multipart |
| Upload editorial multipart | 19.000.000 bytes + até 100.000 bytes de envelope |
| Upload binário interno | 19.000.000 bytes |

O envelope extra evita rejeitar um arquivo válido apenas porque o multipart acrescenta boundary e headers. O tamanho do arquivo continua sendo conferido separadamente.

## Como a correção interrompe Caio

Na nova implementação, a ausência de `Content-Length` não concede tamanho zero. Cada chunk é contado. Quando o byte 65.537 chega a uma rota limitada a 65.536, o leitor tenta cancelar o stream e responde 413 sem receber ou analisar o restante.

Se Caio declarar `Content-Length: 1`, a aplicação ainda conta o corpo real e toma a mesma decisão. Se declarar antecipadamente um tamanho acima do limite, o hook rejeita antes de iniciar o parsing. Se enviar um valor malformado, recebe 400.

Assim, o header serve para desempenho, enquanto o stream real serve como autoridade de segurança.

## Testes de regressão

`tests/request-body-limit.test.ts` cobre:

1. corpo chunked acima do limite e sem `Content-Length`;
2. header menor que o corpo real;
3. header declarado acima do limite;
4. contagem por bytes UTF-8, não por quantidade de caracteres JavaScript;
5. JSON válido e JSON malformado;
6. reconstrução segura de formulário multipart dentro do limite.

O caso UTF-8 é importante: quatro caracteres `é` ocupam oito bytes. Limitar por `string.length` produziria uma medida diferente da memória e do tráfego realmente consumidos.

## Verificação manual segura

Executar somente contra servidor local ou ambiente descartável autorizado. Um teste deve transmitir um corpo ligeiramente acima do limite sem `Content-Length` e confirmar:

```text
HTTP 413
Arquivo ou solicitação acima do limite
```

Repetir com um `Content-Length` propositalmente menor. O resultado deve ser o mesmo. Um corpo exatamente no limite deve continuar aceito e chegar ao parser correspondente.

Também é necessário observar memória durante o teste: o consumo por requisição deve permanecer próximo ao limite configurado, e não ao tamanho total que o remetente tentou transmitir.

## Detecção e resposta

Recomenda-se registrar, sem armazenar o corpo:

- rota e método;
- limite aplicado;
- bytes recebidos até a interrupção;
- presença, ausência ou invalidade de `Content-Length`;
- IP fornecido pela camada confiável da Cloudflare;
- usuário autenticado, quando existir;
- identificador de correlação.

Criar alerta para muitos 413 pelo mesmo IP, múltiplas conexões longas ou crescimento simultâneo de latência e memória. Rate limiting no edge continua necessário: o leitor limita o custo de cada requisição, enquanto o rate limit controla quantas requisições o atacante pode iniciar.

## Resultado esperado

Depois da correção, nenhum endpoint em escopo materializa corpo controlado pelo cliente sem antes aplicar um limite baseado nos bytes realmente lidos. `Content-Length` deixa de ser uma fronteira de segurança e passa a ser somente uma otimização de rejeição antecipada.
