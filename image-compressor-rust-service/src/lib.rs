use clap::{Parser, CommandFactory};
use clap_verbosity_flag::{Verbosity, InfoLevel};
use anyhow::{Result, Context, bail};
use std::path::{Path, PathBuf};
use std::fs;
use std::io::{self, Write};
use is_terminal::IsTerminal;
use log::{info, debug, error};

// Re-export necessary types from zune_image and zune_core for image conversion
use zune_core::colorspace::ColorSpace;
use zune_core::bit_depth::BitDepth;
use zune_image::image::Image;
use rimage::codecs::mozjpeg::{MozJpegEncoder, MozJpegOptions};
use rimage::traits::EncoderTrait;

/// A robust and optimized JPEG image compressor.
#[command(name = "image-compressor")]
#[command(version)]
#[command(about = "A robusto e otimizado compressor de imagens JPEG.")]
struct Cli {
    /// Path to the input image file.
    input: PathBuf,

    /// Path for the output compressed image file.
    output: PathBuf,

    /// JPEG quality level (1-100).
    #[arg(long, short, default_value_t = 75, value_parser = clap::value_parser!(u8).range(1..=100), help = "Nível de qualidade JPEG (1-100).")]
    quality: u8,

    /// Overwrite output file if it exists without prompting.
    overwrite: bool,

    #[command(flatten)]
    verbosity: Verbosity<InfoLevel>,
}

fn main() -> Result<()> {
    // Initialize logger based on verbosity flag
    env_logger::Builder::new()
       .filter_level(log::LevelFilter::Error) // Default to Error, InfoLevel from clap_verbosity_flag takes precedence
       .filter_level(Cli::command().parse().unwrap().verbosity.log_level_filter())
       .init();

    let cli = Cli::parse();

    debug!("Argumentos analisados: {:?}", cli);

    // 1. Validação de Argumentos: Verificar se os caminhos de entrada e saída são válidos.
    if !cli.input.exists() {
        bail!("Erro: Arquivo de entrada não encontrado: '{}'", cli.input.display());
    }
    if !cli.input.is_file() {
        bail!("Erro: O caminho de entrada não é um arquivo: '{}'", cli.input.display());
    }

    // Verificar existência do arquivo de saída
    if cli.output.exists() {
        if !cli.overwrite {
            if io::stdout().is_terminal() {
                // Ambiente interativo, perguntar ao usuário
                print!("Arquivo de saída '{}' já existe. Deseja sobrescrever? (y/N): ", cli.output.display());
                io::stdout().flush().context("Falha ao descarregar stdout")?;

                let mut input = String::new();
                io::stdin().read_line(&mut input).context("Falha ao ler entrada do usuário")?;
                let input = input.trim().to_lowercase();

                if input != "y" && input != "sim" {
                    info!("Operação cancelada pelo usuário.");
                    return Ok(());
                }
                info!("Sobrescrevendo arquivo de saída...");
            } else {
                // Ambiente não interativo, retornar erro
                bail!("Erro: Arquivo de saída '{}' já existe. Use a flag --overwrite para sobrescrever em modo não interativo.", cli.output.display());
            }
        } else {
            info!("Flag --overwrite detectada. Sobrescrevendo arquivo de saída '{}'.", cli.output.display());
        }
    }

    // Garantir que o diretório de saída exista
    if let Some(parent) = cli.output.parent() {
        if !parent.exists() {
            debug!("Criando diretório de saída: {}", parent.display());
            fs::create_dir_all(parent)
               .context(format!("Falha ao criar diretório de saída: '{}'", parent.display()))?;
        }
    }

    info!("Iniciando compressão: '{}' -> '{}' com qualidade {}", cli.input.display(), cli.output.display(), cli.quality);

    // Processamento da imagem
    process_image_compression(&cli.input, &cli.output, cli.quality, cli.verbosity.log_level_filter())
       .context("Falha durante o processamento da imagem")?;

    info!("Compressão concluída com sucesso!");

    Ok(())
}

/// Handles the core image loading, conversion, compression, and saving logic.
fn process_image_compression(
    input_path: &Path,
    output_path: &Path,
    quality: u8,
    log_level: log::LevelFilter,
) -> Result<()> {
    // 2. Processamento de Imagem: Usar a crate `image` para abrir a imagem de entrada.
    debug!("Carregando imagem de entrada: {}", input_path.display());
    let dynamic_img = image::io::Reader::open(input_path)
       .context(format!("Falha ao abrir arquivo de imagem: '{}'", input_path.display()))?
       .decode()
       .context(format!("Falha ao decodificar imagem de entrada. Formato pode ser não suportado ou arquivo corrompido: '{}'", input_path.display()))?;

    info!("Imagem de entrada carregada ({}x{}, {:?}).", dynamic_img.width(), dynamic_img.height(), dynamic_img.color());

    // Se a imagem não for JPEG, convertê-la para o formato JPEG antes da compressão.
    // Mozjpeg (via rimage) espera dados RGB8.
    let rgb_image = dynamic_img.into_rgb8(); // Memory efficient conversion
    info!("Imagem convertida para RGB8 para compressão.");

    // Convert image::RgbImage to zune_image::image::Image
    let (width, height) = rgb_image.dimensions();
    let pixels = rgb_image.into_raw(); // Get raw pixel data (Vec<u8>)
    
    // Construct zune_image::image::Image from raw pixel data
    let zune_img = Image::from_vec(
        pixels,
        width as usize,
        height as usize,
        ColorSpace::RGB,
        BitDepth::Eight
    )
   .context("Falha ao converter imagem para o formato interno do compressor (zune_image).")?;

    debug!("Imagem preparada para compressão com zune_image ({}x{}, {:?}).", zune_img.width(), zune_img.height(), zune_img.colorspace());

    // Utilizar a compressão `mozjpeg` (via `rimage`)
    let options = MozJpegOptions {
        quality: quality as f32, // rimage expects f32 for quality
       ..Default::default()
    };

    let mut encoder = MozJpegEncoder::new_with_options(options);
    let mut compressed_bytes = Vec::new();

    info!("Comprimindo imagem com mozjpeg (qualidade: {}).", quality);
    encoder.encode(&zune_img, &mut compressed_bytes)
       .context("Falha durante a compressão da imagem com mozjpeg.")?;

    info!("Imagem comprimida. Tamanho original: {} bytes, Tamanho comprimido: {} bytes.",
        fs::metadata(input_path)?.len(), compressed_bytes.len());

    // Salvar a imagem comprimida no caminho de saída.
    debug!("Salvando imagem comprimida em: {}", output_path.display());
    fs::write(output_path, compressed_bytes)
       .context(format!("Falha ao salvar a imagem comprimida em: '{}'. Verifique permissões ou espaço em disco.", output_path.display()))?;

    Ok(())
}

/// Compresses an image from a byte slice to JPEG format using mozjpeg.
///
/// This function is designed for in-memory operations, making it suitable for web services.
/// It decodes the input from any format supported by the `image` crate, converts it
/// to the RGB8 format required by mozjpeg, and then performs the compression.
///
/// # Arguments
///
/// * `input_bytes` - A byte slice `&[u8]` containing the raw data of the input image.
/// * `quality` - A `u8` value from 1 to 100 representing the desired JPEG quality.
///
/// # Returns
///
/// * `Result<Vec<u8>>` - On success, returns a `Vec<u8>` with the compressed JPEG data.
///   On failure, returns an `anyhow::Error` detailing the cause of the failure.
///
pub fn compress_image_bytes(input_bytes: &[u8], quality: u8) -> Result<Vec<u8>> {
    // Step 1: Decode the input image from memory.
    // The `image` crate automatically detects the format from the byte stream.
    debug!("Decoding image from memory ({} bytes)", input_bytes.len());
    let dynamic_img = image::load_from_memory(input_bytes)
        .context("Failed to decode input image. The format may be unsupported or the data is corrupted.")?;
    debug!(
        "Decoded image successfully ({}x{}, color type: {:?})",
        dynamic_img.width(),
        dynamic_img.height(),
        dynamic_img.color()
    );

    // Step 2: Convert the image to RGB8 format.
    // This is a necessary step as JPEG does not support alpha channels (transparency)
    // and the mozjpeg encoder expects pixels in the RGB8 format.
    let rgb_image = dynamic_img.into_rgb8();
    let (width, height) = rgb_image.dimensions();
    let pixels = rgb_image.into_raw();
    debug!("Converted image to RGB8 format for compression.");

    // Step 3: Bridge to the `zune_image::Image` type required by the `rimage` encoder.
    let zune_img = Image::from_vec(
        pixels,
        width as usize,
        height as usize,
        ColorSpace::RGB,
        BitDepth::Eight,
    )
    .context("Failed to convert image to the internal zune_image format for the compressor.")?;
    debug!(
        "Bridged to zune_image format successfully ({}x{})",
        zune_img.width(),
        zune_img.height()
    );

    // Step 4: Configure mozjpeg compression options.
    let options = MozJpegOptions {
        quality: quality as f32,
        ..Default::default()
    };
    debug!("Set mozjpeg quality to {}", quality);

    // Step 5: Create the encoder and perform the compression.
    let mut encoder = MozJpegEncoder::new_with_options(options);
    let mut compressed_bytes = Vec::new();

    encoder
        .encode(&zune_img, &mut compressed_bytes)
        .context("Image encoding with mozjpeg failed.")?;
    debug!(
        "Compression successful. Original size: {} bytes, Compressed size: {} bytes",
        input_bytes.len(),
        compressed_bytes.len()
    );

    // Step 6: Return the resulting compressed bytes.
    Ok(compressed_bytes)
}
