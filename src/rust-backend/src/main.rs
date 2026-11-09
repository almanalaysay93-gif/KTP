use ktp_backend::{AppState, app};
use sqlx::postgres::PgPoolOptions;
use std::{env, net::SocketAddr, sync::Arc, time::Duration};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "ktp_backend=info".into()),
        )
        .init();
    let database_url = env::var("DATABASE_URL").map_err(|_| "DATABASE_URL is required")?;
    let secret = env::var("JWT_SECRET")
        .map_err(|_| "JWT_SECRET is required; use the same secret as Node")?;
    if secret.len() < 32 {
        return Err("JWT_SECRET must contain at least 32 bytes".into());
    }
    let address: SocketAddr = env::var("RUST_BIND_ADDR")
        .unwrap_or_else(|_| "127.0.0.1:3001".into())
        .parse()?;
    if env::var("KTP_LOCAL_MODE").as_deref() == Ok("1") {
        let url = reqwest::Url::parse(&database_url).map_err(|_| "Invalid local database URL")?;
        if !address.ip().is_loopback()
            || !matches!(
                url.host_str(),
                Some("127.0.0.1" | "localhost" | "[::1]" | "::1")
            )
        {
            return Err("Local mode requires loopback API and database addresses".into());
        }
    }
    let pool = PgPoolOptions::new()
        .max_connections(3)
        .acquire_timeout(Duration::from_secs(5))
        .connect(&database_url)
        .await
        .map_err(|_| "Could not connect to PostgreSQL")?;
    // Deliberately no automatic DDL or seed writes. Node owns schema migrations.
    sqlx::query("SELECT id FROM ktp.users LIMIT 1")
        .execute(&pool)
        .await
        .map_err(
            |_| "Existing ktp schema is required; apply current application migrations first",
        )?;
    let listener = tokio::net::TcpListener::bind(address).await?;
    tracing::info!(%address, "Rust backend listening");
    axum::serve(
        listener,
        app(AppState {
            pool,
            secret: Arc::from(secret.into_bytes()),
        })
        .into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown())
    .await?;
    Ok(())
}

async fn shutdown() {
    #[cfg(unix)]
    {
        let mut term = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("SIGTERM handler");
        tokio::select! { _ = tokio::signal::ctrl_c() => {}, _ = term.recv() => {} }
    }
    #[cfg(not(unix))]
    {
        let _ = tokio::signal::ctrl_c().await;
    }
}
