using System.Reflection.Metadata;
using System.Reflection.PortableExecutable;

namespace Stillpoint.Tools;

/// <summary>Read an assembly without loading it into the process.</summary>
public sealed class SnapshotReader
{
    public async Task<IReadOnlyList<string>> ReadTypesAsync(
        string path, CancellationToken cancellationToken = default)
    {
        await using var stream = File.OpenRead(path);
        using var pe = new PEReader(stream);
        var reader = pe.GetMetadataReader();
        var names = new List<string>();

        foreach (var handle in reader.TypeDefinitions)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var type = reader.GetTypeDefinition(handle);
            names.Add(reader.GetString(type.Name));
        }

        await Task.Yield();
        return names;
    }
}
